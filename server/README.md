# LearnLoop Server

FastAPI-based server for the LearnLoop application.

## Prerequisites

- Python 3.11 or higher
- pip

## Setup

### Install Dependencies

For development (includes all dev tools):
```bash
make dev
```

For production only:
```bash
make install
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

- `make install` - Install production dependencies
- `make install-dev` - Install development dependencies  
- `make dev` - Install all dependencies (production + development)
- `make format` - Format code with Ruff
- `make lint` - Run linter checks
- `make typecheck` - Run MyPy for static type checking
- `make test` - Run all tests
- `make test-cov` - Run tests with coverage
- `make run` - Start development server
- `make prod` - Start production server
- `make stop` - Stop running processes
- `make clean` - Clean up generated files and cache
- `make help` - Show help message

## Dependencies

### Production Dependencies
- fastapi - Web framework
- uvicorn - ASGI server
- gunicorn - WSGI HTTP Server
- openai - OpenAI API client
- openai-agents - OpenAI agents
- aioritc - Async rate limiting
- websockets - WebSocket support
- supabase - Supabase client
- python-multipart - File upload support
- pydantic - Data validation
- pydantic-settings - Settings management
- httpx - HTTP client
- python-dotenv - Environment variable management

### Development Dependencies
- pytest - Testing framework
- pytest-asyncio - Async testing support
- pytest-cov - Coverage reporting
- ruff - Fast Python linter and formatter
- mypy - Static type checker
- black - Code formatter
- isort - Import sorting
- pre-commit - Git hooks

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