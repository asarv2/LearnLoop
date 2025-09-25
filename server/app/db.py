# app/db.py
import logging
import os
from collections.abc import Generator, Iterator
from contextlib import contextmanager

from dotenv import load_dotenv
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()
logger = logging.getLogger(__name__)

db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")
db_port = os.getenv("DB_PORT")
db_host = os.getenv("DB_HOST")

db_url = f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"
if not db_url:
    raise ValueError("Database url is not set")

engine = create_engine(
    db_url,
    pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
    max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
    pool_pre_ping=True,  # ping before checkout to kill dead conns
    pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")),
    pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
    pool_use_lifo=True,  # reduce thundering herd on hot services
    echo=False,  # flip to True if you want SQL debug
    connect_args={
        # TCP keepalives so idle connections get probed and revived/closed by kernel
        "keepalives": 1,
        "keepalives_idle": int(os.getenv("PG_KEEPALIVES_IDLE", "30")),
        "keepalives_interval": int(os.getenv("PG_KEEPALIVES_INTERVAL", "10")),
        "keepalives_count": int(os.getenv("PG_KEEPALIVES_COUNT", "5")),
        # NOTE: sslmode is provided via the URL. Add more libpq args here if needed.
    },
)

# IMPORTANT: use a factory that creates a NEW Session every time
SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Smoke test
try:
    with engine.connect() as connection:
        print("Connection successful!")
except Exception as e:
    print(f"Failed to connect: {e}")


def init_db() -> None:
    if os.getenv("DOCKER_ENV"):
        print(
            "🐳 Running in Docker - skipping SQLModel schema creation (using SQL files instead)"
        )
        return
    print("🔧 Creating database schema via SQLModel...")
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """
    Yield a fresh SQLAlchemy session.
    Always do a best-effort rollback on acquire to clear any aborted txn
    that might linger on a pooled connection.
    """
    db = SessionLocal()
    try:
        try:
            db.rollback()  # no-op if clean, clears "aborted transaction" state if any
        except Exception:
            pass
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            db.close()
        except Exception:
            pass


def get_session_safe() -> Session:
    """Return a fresh session (remember to rollback/close on exceptions!)."""
    db = SessionLocal()
    try:
        try:
            db.rollback()
        except Exception:
            pass
        return db
    except Exception as e:
        logger.error(f"Failed to create database session: {e}")
        raise


@contextmanager
def session_scope() -> Iterator[Session]:
    """
    Preferred context manager for sync code:
        with session_scope() as db:
            ... db.add(...); db.commit()
    Automatically rolls back on exception and always closes.
    """
    db = SessionLocal()
    try:
        try:
            db.rollback()
        except Exception:
            pass
        yield db
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            db.close()
        except Exception:
            pass


def reset_connection_pool() -> None:
    try:
        logger.info("Resetting database connection pool...")
        engine.dispose()
        logger.info("Database connection pool reset successfully")
    except Exception as e:
        logger.error(f"Error resetting database connection pool: {e}")
