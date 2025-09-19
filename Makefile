.PHONY: help setup install clean format lint typecheck run prod test test-cov cleanup generate-models generate-tests stop test-fast test-slow test-unit test-integration typecheck-strict start-redis start-client start-server start-model start-documents stop-all

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

# PID files for service management
SERVER_PID := .server.pid
MODEL_PID := .model.pid
DOCUMENTS_PID := .documents.pid
CLIENT_PID := .client.pid
REDIS_PID := .redis.pid

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

# Start individual services
start-redis:
	@echo "⇢ starting Redis on :$(REDIS_PORT)"
	@redis-server --port $(REDIS_PORT) --daemonize yes --pidfile $(REDIS_PID)
	@echo "✅ Redis started on port $(REDIS_PORT)"

start-server: check-venv start-redis
	@echo "⇢ starting server on :$(SERVER_PORT)"
	@cd server && $(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(SERVER_PORT) > ../$(SERVER_PID) 2>&1 &
	@echo $$! > $(SERVER_PID)
	@echo "✅ Server started on port $(SERVER_PORT) (PID: $$!)"

start-model: check-venv
	@echo "⇢ starting model service on :$(MODEL_PORT)"
	@cd model && $(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(MODEL_PORT) > ../$(MODEL_PID) 2>&1 &
	@echo $$! > $(MODEL_PID)
	@echo "✅ Model service started on port $(MODEL_PORT) (PID: $$!)"

start-documents: check-venv
	@echo "⇢ starting documents service on :$(DOCUMENTS_PORT)"
	@cd documents && $(VENV_PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port $(DOCUMENTS_PORT) > ../$(DOCUMENTS_PID) 2>&1 &
	@echo $$! > $(DOCUMENTS_PID)
	@echo "✅ Documents service started on port $(DOCUMENTS_PORT) (PID: $$!)"

start-client:
	@echo "⇢ starting client on :$(CLIENT_PORT)"
	@cd client && npm run dev > ../$(CLIENT_PID) 2>&1 &
	@echo $$! > $(CLIENT_PID)
	@echo "✅ Client started on port $(CLIENT_PORT) (PID: $$!)"

# Start all services
run: start-server start-model start-documents start-client
	@echo "✅ All services started!"
	@echo "  Redis:    localhost:$(REDIS_PORT)"
	@echo "  Server:   http://localhost:$(SERVER_PORT)"
	@echo "  Model:    http://localhost:$(MODEL_PORT)"
	@echo "  Documents: http://localhost:$(DOCUMENTS_PORT)"
	@echo "  Client:   http://localhost:$(CLIENT_PORT)"
	@echo ""
	@echo "Use 'make stop' to stop all services"

# Stop all services
stop-all:
	@echo "Stopping all services..."
	@if [ -f $(SERVER_PID) ]; then kill `cat $(SERVER_PID)` 2>/dev/null || true; rm $(SERVER_PID); echo "✅ Server stopped"; fi
	@if [ -f $(MODEL_PID) ]; then kill `cat $(MODEL_PID)` 2>/dev/null || true; rm $(MODEL_PID); echo "✅ Model service stopped"; fi
	@if [ -f $(DOCUMENTS_PID) ]; then kill `cat $(DOCUMENTS_PID)` 2>/dev/null || true; rm $(DOCUMENTS_PID); echo "✅ Documents service stopped"; fi
	@if [ -f $(CLIENT_PID) ]; then kill `cat $(CLIENT_PID)` 2>/dev/null || true; rm $(CLIENT_PID); echo "✅ Client stopped"; fi
	@if [ -f $(REDIS_PID) ]; then kill `cat $(REDIS_PID)` 2>/dev/null || true; rm $(REDIS_PID); echo "✅ Redis stopped"; fi
	@echo "✅ All services stopped"

# Stop any running processes
stop: stop-all
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
	@find . -type f -name "*.pid" -delete 2>/dev/null || true
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
	@echo "  run          - Start all services (redis, server, model, documents, client)"
	@echo "  start-redis  - Start Redis on port $(REDIS_PORT)"
	@echo "  start-server - Start server on port $(SERVER_PORT)"
	@echo "  start-model  - Start model service on port $(MODEL_PORT)"
	@echo "  start-documents - Start documents service on port $(DOCUMENTS_PORT)"
	@echo "  start-client - Start client on port $(CLIENT_PORT)"
	@echo "  stop         - Stop all services"
	@echo "  stop-all     - Stop all services"
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
