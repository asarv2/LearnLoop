import os
from typing import Generator

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

load_dotenv()

db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")
db_port = os.getenv("DB_PORT")
db_host = os.getenv("DB_HOST")

# Construct the database URL
db_url = f"postgresql+psycopg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

if not db_url:
    raise ValueError("Database url is not set")
engine = create_engine(db_url)

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
    with Session(engine) as session:
        yield session
