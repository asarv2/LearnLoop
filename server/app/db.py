import logging
import os
from typing import Generator

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()

logger = logging.getLogger(__name__)

db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")
db_port = os.getenv("DB_PORT")
db_host = os.getenv("DB_HOST")

# Construct the database URL
db_url = f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

if not db_url:
    raise ValueError("Database url is not set")

# Create engine with standard configuration
engine = create_engine(
    db_url,
    # Use standard connection pooling
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Test the connection
try:
    with engine.connect() as connection:
        print("Connection successful!")
except Exception as e:
    print(f"Failed to connect: {e}")


def init_db() -> None:
    # Skip schema creation if running in Docker environment
    # Docker initialization already creates the schema from SQL files
    if os.getenv("DOCKER_ENV"):
        print("🐳 Running in Docker - skipping SQLModel schema creation (using SQL files instead)")
        return
    
    print("🔧 Creating database schema via SQLModel...")
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Get a database session with error handling."""
    session = None
    try:
        session = Session(engine)
        yield session
    except Exception as e:
        logger.error(f"Database session error: {e}")
        if session:
            session.rollback()
        raise
    finally:
        if session:
            session.close()


def get_session_safe() -> Session:
    """Get a database session for use in async contexts where generator pattern doesn't work."""
    try:
        return Session(engine)
    except Exception as e:
        logger.error(f"Failed to create database session: {e}")
        raise


def reset_connection_pool() -> None:
    """Reset the database connection pool to clear any stale connections."""
    try:
        logger.info("Resetting database connection pool...")
        engine.dispose()
        logger.info("Database connection pool reset successfully")
    except Exception as e:
        logger.error(f"Error resetting database connection pool: {e}")
