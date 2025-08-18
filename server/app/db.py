import logging
import os
import time
from typing import Any, Callable, Generator, TypeVar

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

# Create engine with proper connection pooling configuration
engine = create_engine(
    db_url,
    # Connection pool settings to prevent prepared statement errors
    pool_size=10,  # Number of connections to maintain in the pool
    max_overflow=20,  # Maximum number of connections that can be created beyond pool_size
    pool_pre_ping=True,  # Validate connections before use
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_timeout=30,  # Timeout for getting a connection from the pool
    # Disable prepared statements to avoid the "_pg3_2" error
    connect_args={
        "options": "-c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000"
    }
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
