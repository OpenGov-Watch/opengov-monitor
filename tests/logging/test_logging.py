import os
import tempfile
import logging
import json
from pathlib import Path
import pytest
from utils.custom_logging import setup_logging


def test_logging_with_extra_fields():
    """Test logging with extra fields."""

    logger, memory_handler = setup_logging()

    try:
        # Test logging with extra fields
        test_extra = {"test_field": "test_value", "number": 123}
        logger.debug("Test message", extra=test_extra)

        # Flush the memory handler
        memory_handler.flush()

        # Check the captured logs
        log_content = "".join([record.msg for record in memory_handler.buffer])
        assert "Test message" in log_content
        assert "test_value" in log_content
        assert "123" in log_content
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)


def test_extra_formatter():
    """Test the extra formatter."""

    logger, memory_handler = setup_logging()

    try:
        # Log a message with extra fields
        logger.info("Test message", extra={"key": "value"})

        # Flush the memory handler
        memory_handler.flush()

        # Check the captured logs
        log_content = "".join([record.msg for record in memory_handler.buffer])
        assert "Test message" in log_content
        assert "key" in log_content
        assert "value" in log_content
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)