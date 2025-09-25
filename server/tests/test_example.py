"""
Example test file to demonstrate the testing setup.
"""

from typing import Any

import pytest  # type: ignore


@pytest.mark.fast()
@pytest.mark.unit()
def test_fast_unit_example() -> None:
    """Example of a fast unit test."""
    assert 1 + 1 == 2


@pytest.mark.slow()
@pytest.mark.integration()
def test_slow_integration_example() -> None:
    """Example of a slow integration test."""
    # This would typically involve external dependencies
    assert True


@pytest.mark.fast()
def test_string_operations() -> None:
    """Test string operations."""
    text = "hello world"
    assert text.upper() == "HELLO WORLD"
    assert len(text) == 11


@pytest.mark.unit()
def test_list_operations() -> None:
    """Test list operations."""
    numbers = [1, 2, 3, 4, 5]
    assert sum(numbers) == 15
    assert len(numbers) == 5


class TestExampleClass:
    """Example test class."""

    @pytest.mark.fast()
    @pytest.mark.unit()
    def test_class_method(self) -> None:
        """Test a class method."""
        assert hasattr(self, "test_class_method")

    @pytest.mark.slow()
    def test_slow_class_method(self) -> None:
        """Test a slow class method."""
        # Simulate some slow operation
        result = sum(range(1000))
        assert result == 499500


# Example of parametrized tests
@pytest.mark.parametrize(
    "input_value,expected",
    [
        (1, 2),
        (2, 4),
        (3, 6),
        (10, 20),
    ],
)
@pytest.mark.fast()
@pytest.mark.unit()
def test_multiply_by_two(input_value: int, expected: int) -> None:
    """Test multiplication by 2."""
    assert input_value * 2 == expected


# Example of fixtures
@pytest.fixture()
def sample_data() -> dict[str, Any]:
    """Sample data fixture."""
    return {"name": "test", "value": 42, "items": [1, 2, 3]}


@pytest.mark.fast()
@pytest.mark.unit()
def test_with_fixture(sample_data: dict[str, Any]) -> None:
    """Test using a fixture."""
    assert sample_data["name"] == "test"
    assert sample_data["value"] == 42
    assert len(sample_data["items"]) == 3
