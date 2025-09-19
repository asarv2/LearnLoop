.PHONY: help install install-dev dev format lint typecheck run prod test test-cov clean generate-models generate-tests stop venv venv-clean test-fast test-slow test-unit test-integration typecheck-strict redis-install redis-start redis-stop check-brew

# Default Python interpreter
PYTHON := python3.11
VENV := .venv
VENV_BIN := $(VENV)/bin
VENV_PYTHON := $(VENV_BIN)/python
VENV_PIP := $(VENV_BIN)/pip

# Check if Python 3.11 is available
PY311 := $(shell which python3.11 || true)

# Arguments for test command
ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))

# Check if Python 3.11 is available
check-python:
	@if [ -z "$(PY311)" ]; then \
		echo "❌  python3.11 not found - please install Python 3.11"; \
		exit 1; \
	fi

# --- Homebrew Redis Management ---
# Check if Homebrew is installed
check-brew:
	@if ! command -v brew &> /dev/null; then \
		echo "❌ Homebrew is not installed. Please install it to continue: https://brew.sh/"; \
		exit 1; \
	fi

# Install Redis using Homebrew if not already installed
redis-install: check-brew
	@if ! brew ls --versions redis > /dev/null; then \
		echo "🍺 Installing Redis via Homebrew..."; \
		brew install redis; \
		echo "✅ Redis installed."; \
	else \
		echo "🍺 Redis is already installed."; \
	fi

# Start Redis as a background service
redis-start: redis-install
	@echo "🍺 Starting Redis service via Homebrew...";
	@brew services start redis
	@echo "✅ Redis service started."

# Stop the Redis service
redis-stop: check-brew
	@echo "🍺 Stopping Redis service...";
	@brew services stop redis
	@echo "✅ Redis service stopped."
# --- End Homebrew Redis Management ---

# Create virtual environment
venv: check-python
	@echo "Creating virtual environment at $(VENV)..."
	@$(PYTHON) -m venv $(VENV)
	@echo "✅ Virtual environment created at $(VENV)"
	@echo "To activate: source $(VENV_BIN)/activate"

# Clean virtual environment
venv-clean:
	@echo "Removing virtual environment..."
	@rm -rf $(VENV)
	@echo "✅ Virtual environment removed"

# Check if virtual environment exists
check-venv:
	@if [ ! -d "$(VENV)" ]; then \
		echo "❌ Virtual environment not found at $(VENV)"; \
		echo "Run 'make venv' to create it"; \
		exit 1; \
	fi

# Install production dependencies
install: check-venv
	@echo "Installing production dependencies..."
	@$(VENV_PIP) install --upgrade pip
	@$(VENV_PIP) install -e .
	@echo "✅ Production dependencies installed"

# Install development dependencies
install-dev: check-venv
	@echo "Installing development dependencies..."
	@$(VENV_PIP) install --upgrade pip
	@$(VENV_PIP) install -e ".[dev]"
	@echo "✅ Development dependencies installed"

# Install all dependencies (production + development)
dev: venv install-dev redis-start
	@echo "✅ Development environment ready!"
	@echo "To activate: source $(VENV_BIN)/activate"

# Format code with Ruff
format: check-venv
	@echo "Formatting code with Ruff..."
	@$(VENV_PYTHON) -m ruff format .
	@$(VENV_PYTHON) -m ruff check --fix .
	@echo "✅ Code formatted"

# Run linter checks
lint: check-venv
	@echo "Running linter..."
	@$(VENV_PYTHON) -m ruff check .
	@echo "✅ Linting complete"

# Run MyPy for static type checking
typecheck: check-venv
	@echo "Type checking..."
	@$(VENV_PYTHON) -m mypy app
	@echo "✅ Type checking complete"

# Run MyPy with strict settings
typecheck-strict: check-venv
	@echo "Strict type checking..."
	@$(VENV_PYTHON) -m mypy app --strict
	@echo "✅ Strict type checking complete"

# Generate SQLModel classes from database schema
generate-models: check-venv
	@echo "Generating SQLModel classes from database schema..."
	@$(VENV_PYTHON) scripts/generate_models.py
	@echo "✅ Models generated"

# Generate pytest tests for routes and services
generate-tests: check-venv
	@echo "Generating pytest tests..."
	@$(VENV_PYTHON) scripts/generate_pytest_tests.py
	@echo "✅ Tests generated"

# Run all tests
test: check-venv
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		$(VENV_PYTHON) -m pytest $(ARGS) -v; \
	else \
		echo "Running all pytest tests..."; \
		$(VENV_PYTHON) -m pytest tests/ -v; \
	fi

# Run tests with coverage
test-cov: check-venv
	@echo "Running pytest tests with coverage..."
	@$(VENV_PYTHON) -m pytest tests/ --cov=app --cov-report=term-missing --cov-report=html
	@echo "✅ Coverage report generated"

# Run the development server
run: check-venv redis-start generate-models
	@echo "⇢ starting API server on :8000"
	@$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Stop any running processes
stop: redis-stop
	@if [ -f .model.pid ]; then kill `cat .model.pid` || true; rm .model.pid; fi
	@echo "✅ Stopped running processes and services"

# Start FastAPI via Gunicorn+Uvicorn for production
prod: check-venv
	@echo "Starting FastAPI server in production mode..."
	@$(VENV_PYTHON) -m gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Clean up generated files and cache
clean:
	@echo "Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name "*.pyo" -delete 2>/dev/null || true
	@find . -type f -name "*.pyd" -delete 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name ".coverage" -delete 2>/dev/null || true
	@find . -type f -name ".model.pid" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Show help
help:
	@echo "LearnLoop Server - Available commands:"
	@echo ""
	@echo "Environment setup:"
	@echo "  venv         - Create virtual environment at .venv"
	@echo "  venv-clean   - Remove virtual environment"
	@echo "  dev          - Set up complete development environment (venv + redis + install-dev)"
	@echo ""
	@echo "Dependencies:"
	@echo "  install      - Install production dependencies in venv"
	@echo "  install-dev  - Install development dependencies in venv"
	@echo ""
	@echo "Code quality:"
	@echo "  format       - Format code with Ruff"
	@echo "  lint         - Run linter checks"
	@echo "  typecheck    - Run MyPy for static type checking"
	@echo "  typecheck-strict - Run MyPy with strict settings"
	@echo ""
	@echo "Testing:"
	@echo "  test         - Run all tests"
	@echo "  test-cov     - Run tests with coverage"
	@echo "  test-fast    - Run fast tests only"
	@echo "  test-slow    - Run slow tests only"
	@echo "  test-unit    - Run unit tests only"
	@echo "  test-integration - Run integration tests only"
	@echo ""
	@echo "Development:"
	@echo "  run          - Start development server and Redis"
	@echo "  prod         - Start production server"
	@echo "  stop         - Stop running processes and Redis"
	@echo "  clean        - Clean up generated files and cache"
	@echo ""
	@echo "Services (Homebrew):"
	@echo "  redis-install - Install Redis via Homebrew"
	@echo "  redis-start   - Start the Redis service"
	@echo "  redis-stop    - Stop the Redis service"
	@echo ""
	@echo "Code generation:"
	@echo "  generate-models - Generate SQLModel classes from database schema"
	@echo "  generate-tests  - Generate pytest tests"
	@echo ""
	@echo "Virtual environment location: $(VENV)"
	@echo "To activate manually: source $(VENV_BIN)/activate"
