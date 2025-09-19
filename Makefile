.PHONY: help setup install clean format lint typecheck run prod test test-cov cleanup generate-models generate-tests stop test-fast test-slow test-unit test-integration typecheck-strict

# Default Python interpreter
PYTHON := python3.11
VENV := .venv
VENV_BIN := $(VENV)/bin
VENV_PYTHON := $(VENV_BIN)/python
VENV_PIP := $(VENV_BIN)/pip

# Service ports
SERVER_PORT := 8000
MODEL_PORT := 8001
DOCUMENTS_PORT := 8002
CLIENT_PORT := 3000
REDIS_PORT := 6379

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


# Create virtual environment
setup: check-python
	@echo "Creating virtual environment at $(VENV)..."
	@$(PYTHON) -m venv $(VENV)
	@echo "✅ Virtual environment created at $(VENV)"
	@echo "To activate: source $(VENV_BIN)/activate"

# Install all dependencies
install: check-venv
	@echo "Installing all dependencies..."
	@$(VENV_PIP) install --upgrade pip
	@$(VENV_PIP) install -e .
	@echo "✅ All dependencies installed"

# Clean virtual environment
clean:
	@echo "Removing virtual environment..."
	@rm -rf $(VENV)
	@echo "✅ Virtual environment removed"

# Check if virtual environment exists
check-venv:
	@if [ ! -d "$(VENV)" ]; then \
		echo "❌ Virtual environment not found at $(VENV)"; \
		echo "Run 'make setup' to create it"; \
		exit 1; \
	fi
	@if [ ! -f "$(VENV_PYTHON)" ]; then \
		echo "❌ Python not found in virtual environment at $(VENV_PYTHON)"; \
		echo "Run 'make setup' to recreate the virtual environment"; \
		exit 1; \
	fi

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

# Start all services in foreground with combined logs
run: check-venv
	@echo "🚀 Starting all LearnLoop services..."
	@echo "  Redis:    localhost:$(REDIS_PORT)"
	@echo "  Server:   http://localhost:$(SERVER_PORT)"
	@echo "  Model:    http://localhost:$(MODEL_PORT)"
	@echo "  Documents: http://localhost:$(DOCUMENTS_PORT)"
	@echo "  Client:   http://localhost:$(CLIENT_PORT)"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo "----------------------------------------"
	@trap 'echo ""; echo "🛑 Stopping all services..."; pkill -f "redis-server.*$(REDIS_PORT)" 2>/dev/null || true; pkill -f "uvicorn.*$(SERVER_PORT)" 2>/dev/null || true; pkill -f "uvicorn.*$(MODEL_PORT)" 2>/dev/null || true; pkill -f "uvicorn.*$(DOCUMENTS_PORT)" 2>/dev/null || true; pkill -f "next dev" 2>/dev/null || true; echo "✅ All services stopped"; exit 0' INT; \
	exec 2>/dev/null; \
	(redis-server --port $(REDIS_PORT) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;31m[REDIS]\033[0m %s' "$$line")"; done) & \
	(cd server && $(PWD)/$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(SERVER_PORT) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;32m[SERVER]\033[0m %s' "$$line")"; done) & \
	(cd model && $(PWD)/$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(MODEL_PORT) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;33m[MODEL]\033[0m %s' "$$line")"; done) & \
	(cd documents && $(PWD)/$(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(DOCUMENTS_PORT) 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;34m[DOCS]\033[0m %s' "$$line")"; done) & \
	(cd client && npm run dev 2>&1 | while IFS= read -r line; do echo "$$(printf '\033[0;35m[CLIENT]\033[0m %s' "$$line")"; done) & \
	wait

# Stop all services (for cleanup)
stop:
	@echo "🛑 Stopping all LearnLoop services..."
	@pkill -f "redis-server.*$(REDIS_PORT)" 2>/dev/null && echo "✅ Redis stopped" || true
	@pkill -f "uvicorn.*$(SERVER_PORT)" 2>/dev/null && echo "✅ Server stopped" || true
	@pkill -f "uvicorn.*$(MODEL_PORT)" 2>/dev/null && echo "✅ Model service stopped" || true
	@pkill -f "uvicorn.*$(DOCUMENTS_PORT)" 2>/dev/null && echo "✅ Documents service stopped" || true
	@pkill -f "next dev" 2>/dev/null && echo "✅ Client stopped" || true
	@echo "✅ All services stopped"

# Start FastAPI via Gunicorn+Uvicorn for production
prod: check-venv
	@echo "Starting FastAPI server in production mode..."
	@$(VENV_PYTHON) -m gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# Clean up generated files and cache
cleanup:
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
	@echo "✅ Cleanup complete"

# Show help
help:
	@echo "LearnLoop - Unified Learning Platform"
	@echo ""
	@echo "Environment setup:"
	@echo "  setup        - Create virtual environment at .venv"
	@echo "  install      - Install all dependencies in venv"
	@echo "  clean        - Remove virtual environment"
	@echo ""
	@echo "Services:"
	@echo "  run          - Start all services in foreground (Ctrl+C to stop)"
	@echo "  stop         - Stop all services (cleanup)"
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
	@echo ""
	@echo "Production:"
	@echo "  prod         - Start production server"
	@echo "  cleanup      - Clean up generated files and cache"
	@echo ""
	@echo "Code generation:"
	@echo "  generate-models - Generate SQLModel classes from database schema"
	@echo "  generate-tests  - Generate pytest tests"
	@echo ""
	@echo "Service URLs:"
	@echo "  Redis:     localhost:$(REDIS_PORT)"
	@echo "  Server:    http://localhost:$(SERVER_PORT)"
	@echo "  Model:     http://localhost:$(MODEL_PORT)"
	@echo "  Documents: http://localhost:$(DOCUMENTS_PORT)"
	@echo "  Client:    http://localhost:$(CLIENT_PORT)"
	@echo ""
	@echo "Virtual environment location: $(VENV)"
	@echo "To activate manually: source $(VENV_BIN)/activate"
