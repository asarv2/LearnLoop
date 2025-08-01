.PHONY: install dev install-dev format lint typecheck run prod test test-cov clean generate-models generate-tests stop

# Default Python interpreter
PYTHON := python3.11
PIP := pip

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

# Install production dependencies
install: check-python
	@echo "Installing production dependencies..."
	@$(PIP) install -e .

# Install development dependencies
install-dev: check-python
	@echo "Installing development dependencies..."
	@$(PIP) install -e ".[dev]"

# Install all dependencies (production + development)
dev: install-dev

# Format code with Ruff
format: check-python
	@echo "Formatting code with Ruff..."
	@$(PYTHON) -m ruff format .
	@$(PYTHON) -m ruff check --fix .

# Run linter checks
lint: check-python
	@echo "Running linter..."
	@$(PYTHON) -m ruff check .

# Run MyPy for static type checking
typecheck: check-python
	@echo "Type checking..."
	@$(PYTHON) -m mypy app --config-file mypy.ini

# Generate SQLModel classes from database schema
generate-models: check-python
	@echo "Generating SQLModel classes from database schema..."
	@$(PYTHON) scripts/generate_models.py

# Generate pytest tests for routes and services
generate-tests: check-python
	@echo "Generating pytest tests..."
	@$(PYTHON) scripts/generate_pytest_tests.py

# Run all tests
test: check-python
	@if [ -n "$(ARGS)" ]; then \
		echo "Running pytest on specific file(s): $(ARGS)"; \
		$(PYTHON) -m pytest $(ARGS) -v; \
	else \
		echo "Running all pytest tests..."; \
		$(PYTHON) -m pytest tests/ -v; \
	fi

# Run tests with coverage
test-cov: check-python
	@echo "Running pytest tests with coverage..."
	@$(PYTHON) -m pytest tests/ --cov=app --cov-report=term-missing --cov-report=html

# Run the development server
run: install-dev generate-models generate-tests
	@echo "⇢ starting API server on :8000"
	@$(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Stop any running processes
stop:
	@if [ -f .model.pid ]; then kill `cat .model.pid` || true; rm .model.pid; fi

# Start FastAPI via Gunicorn+Uvicorn for production
prod: install
	@echo "Starting FastAPI server in production mode..."
	@$(PYTHON) -m gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

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

# Show help
help:
	@echo "Available commands:"
	@echo "  install      - Install production dependencies"
	@echo "  install-dev  - Install development dependencies"
	@echo "  dev          - Install all dependencies (production + development)"
	@echo "  format       - Format code with Ruff"
	@echo "  lint         - Run linter checks"
	@echo "  typecheck    - Run MyPy for static type checking"
	@echo "  test         - Run all tests"
	@echo "  test-cov     - Run tests with coverage"
	@echo "  run          - Start development server"
	@echo "  prod         - Start production server"
	@echo "  stop         - Stop running processes"
	@echo "  clean        - Clean up generated files and cache"
	@echo "  help         - Show this help message"
