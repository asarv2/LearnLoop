# LearnLoop Server

FastAPI-based server for the LearnLoop application.

## Prerequisites

- Python 3.11 or higher
- pip

## Quick Start

### 1. Set up Development Environment

This will create a virtual environment and install all dependencies:

```bash
make dev
```

### 2. Start Development Server

```bash
make run
```

The server will be available at `http://localhost:8000`

## Setup Details

### Virtual Environment

The project uses a virtual environment located at `.venv/`. The Makefile automatically manages this for you.

**Manual virtual environment management:**
```bash
# Create virtual environment
make venv

# Remove virtual environment
make venv-clean

# Activate manually (if needed)
source .venv/bin/activate
```

### Install Dependencies

For development (includes all dev tools):
```bash
make dev
```

For production only:
```bash
make install
```

For development dependencies only:
```bash
make install-dev
```

### Development

Start the development server:
```bash
make run
```

The server will be available at `http://localhost:8000`

### Production

Start the production server:
```bash
make prod
```

## Available Commands

### Environment Setup
- `make venv` - Create virtual environment at .venv
- `make venv-clean` - Remove virtual environment
- `make dev` - Set up complete development environment (venv + install-dev)

### Dependencies
- `make install` - Install production dependencies in venv
- `make install-dev` - Install development dependencies in venv

### Code Quality
- `make format` - Format code with Ruff
- `make lint` - Run linter checks
- `make typecheck` - Run MyPy for static type checking
- `make typecheck-strict` - Run MyPy with strict settings

### Testing
- `make test` - Run all tests
- `make test-cov` - Run tests with coverage
- `make test-fast` - Run fast tests only
- `make test-slow` - Run slow tests only
- `make test-unit` - Run unit tests only
- `make test-integration` - Run integration tests only

### Development
- `make run` - Start development server
- `make prod` - Start production server
- `make stop` - Stop running processes
- `make clean` - Clean up generated files and cache

### Code Generation
- `make generate-models` - Generate SQLModel classes from database schema
- `make generate-tests` - Generate pytest tests

### Help
- `make help` - Show detailed help message

## Testing and Type Checking

### Type Checking with MyPy

The project uses MyPy for static type checking with a comprehensive configuration:

```bash
# Regular type checking
make typecheck

# Strict type checking (more rigorous)
make typecheck-strict
```

The MyPy configuration includes:
- Strict type checking settings
- Error code display
- Column numbers for better error location
- Pretty output formatting
- Automatic exclusion of test files and virtual environments

### Testing with pytest

The project uses pytest with comprehensive coverage reporting:

```bash
# Run all tests
make test

# Run tests with coverage
make test-cov

# Run specific test categories
make test-fast      # Fast tests only
make test-slow      # Slow tests only  
make test-unit      # Unit tests only
make test-integration  # Integration tests only
```

#### Test Markers

Tests can be categorized using pytest markers:

- `@pytest.mark.fast` - Fast-running tests
- `@pytest.mark.slow` - Slow-running tests (external dependencies)
- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests

#### Coverage Reports

The test coverage configuration generates:
- Terminal output with missing lines
- HTML report in `htmlcov/` directory
- XML report for CI/CD integration
- Minimum coverage requirement of 80%

### Example Test Structure

```python
import pytest
from typing import Any

@pytest.mark.fast
@pytest.mark.unit
def test_example() -> None:
    """Example test with proper type hints."""
    assert 1 + 1 == 2

@pytest.mark.slow
@pytest.mark.integration
def test_integration_example() -> None:
    """Example integration test."""
    # Test with external dependencies
    pass
```

## Dependencies

### Production Dependencies
- fastapi - Web framework
- uvicorn - ASGI server
- gunicorn - WSGI HTTP Server
- openai - OpenAI API client
- openai-agents - OpenAI agents
- aiortc - Async WebRTC
- websockets - WebSocket support
- supabase - Supabase client
- python-dotenv - Environment variable management
- httpx - HTTP client
- sqlmodel - SQL database ORM
- sqlalchemy - SQL toolkit and ORM
- psycopg2-binary - PostgreSQL adapter
- psycopg - PostgreSQL adapter (async)
- sqlacodegen - SQLAlchemy model generator
- pydantic - Data validation
- pydantic-settings - Settings management

### Development Dependencies
- pytest - Testing framework
- pytest-asyncio - Async testing support
- pytest-cov - Coverage reporting
- ruff - Fast Python linter and formatter
- mypy - Static type checker
- black - Code formatter
- isort - Import sorting
- pre-commit - Git hooks
- ipython - Enhanced Python shell
- ipdb - Enhanced debugger

## Project Structure

```
server/
├── app/                    # Application code
│   ├── main.py            # FastAPI application entry point
│   ├── lib/               # Library code
│   └── services/          # Business logic services
├── tests/                 # Test files
├── pyproject.toml         # Project configuration and dependencies
├── Makefile              # Development commands
└── README.md             # This file
```

## Virtual Environment Location

The virtual environment is located at `.venv/` in the server directory.

To activate manually: `source .venv/bin/activate` 

