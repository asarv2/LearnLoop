import logging
import os
from pathlib import Path
from typing import Optional

import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

BASE = Path(__file__).resolve().parents[2]
PROMPTS_DIR = BASE / "server" /"prompts"

PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

# Redis client for socket ownership management
redis_client: Optional[redis.Redis] = None

# Fallback in-memory storage for when Redis is unavailable
socket_owner: dict[str, str] = {}  # profile_id -> socket_id

async def init_redis_client() -> None:
    """Initialize Redis client for socket ownership management."""
    global redis_client
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        try:
            client = redis.from_url(redis_url)
            # Test the connection
            await client.ping()
            redis_client = client
            logger.info(f"Redis client initialized successfully: {redis_url}")
        except Exception as e:
            logger.error(f"Failed to initialize Redis client: {e}")
            redis_client = None
    else:
        logger.warning("No REDIS_URL provided - socket ownership will use in-memory storage")
        redis_client = None

async def get_socket_owner(profile_id: str) -> Optional[str]:
    """Get the socket ID that owns a profile from Redis."""
    if not redis_client:
        # Fallback to in-memory storage
        return socket_owner.get(profile_id)
    
    try:
        owner_sid = await redis_client.get(f"socket_owner:{profile_id}")
        return owner_sid.decode('utf-8') if owner_sid else None
    except Exception as e:
        logger.error(f"Redis error getting socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        return socket_owner.get(profile_id)

async def set_socket_owner(profile_id: str, socket_id: str) -> None:
    """Set the socket ID that owns a profile in Redis."""
    if not redis_client:
        # Fallback to in-memory storage
        socket_owner[profile_id] = socket_id
        return
    
    try:
        # Set with expiration (24 hours) to prevent stale data
        await redis_client.setex(f"socket_owner:{profile_id}", 86400, socket_id)
    except Exception as e:
        logger.error(f"Redis error setting socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        socket_owner[profile_id] = socket_id

async def remove_socket_owner(profile_id: str) -> None:
    """Remove the socket ownership for a profile from Redis."""
    if not redis_client:
        # Fallback to in-memory storage
        socket_owner.pop(profile_id, None)
        return
    
    try:
        await redis_client.delete(f"socket_owner:{profile_id}")
    except Exception as e:
        logger.error(f"Redis error removing socket owner for profile {profile_id}: {e}")
        # Fallback to in-memory storage
        socket_owner.pop(profile_id, None)

async def find_profile_by_socket(socket_id: str) -> Optional[str]:
    """Find the profile ID owned by a socket ID."""
    if not redis_client:
        # Fallback to in-memory storage
        for profile_id, sid in socket_owner.items():
            if sid == socket_id:
                return profile_id
        return None
    
    try:
        # Scan through all socket ownership keys to find the matching socket_id
        async for key in redis_client.scan_iter(match="socket_owner:*"):
            owner_sid = await redis_client.get(key)
            if owner_sid and owner_sid.decode('utf-8') == socket_id:
                return str(key.decode('utf-8').replace('socket_owner:', ''))
        return None
    except Exception as e:
        logger.error(f"Redis error finding profile by socket {socket_id}: {e}")
        # Fallback to in-memory storage
        for profile_id, sid in socket_owner.items():
            if sid == socket_id:
                return profile_id
        return None

async def cleanup_redis_client() -> None:
    """Clean up Redis client on shutdown."""
    global redis_client
    if redis_client:
        await redis_client.close()
        logger.info("Redis client closed")
