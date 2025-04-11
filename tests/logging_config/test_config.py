import os
import tempfile
import logging
import json
from pathlib import Path
import pytest
from logging_config.config import setup_logging, load_config

@pytest.fixture
def temp_config_file():
    """Create a temporary config file for testing."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write("""
logging:
  enable_file_logging: true
  log_dir: "test_logs"
  max_file_size_mb: 1
  backup_count: 2
""")
        return f.name

@pytest.fixture
def temp_log_dir():
    """Create a temporary directory for log files."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir

def test_load_config(temp_config_file):
    """Test loading configuration from YAML file."""
    # Set the config file path
    os.environ['CONFIG_FILE'] = temp_config_file
    config = load_config()
    assert config['logging']['enable_file_logging'] is True
    assert config['logging']['log_dir'] == "test_logs"
    assert config['logging']['max_file_size_mb'] == 1
    assert config['logging']['backup_count'] == 2

def test_logging_with_extra_fields(temp_log_dir, temp_config_file):
    """Test logging with extra fields."""
    # Create config file in temp directory
    config_path = Path(temp_log_dir) / 'config.yaml'
    with open(config_path, 'w') as f:
        f.write(f"""
logging:
  enable_file_logging: true
  log_dir: {temp_log_dir!r}
  max_file_size_mb: 1
  backup_count: 2
""")
    
    # Setup logging with test directory
    os.environ['CONFIG_FILE'] = str(config_path)
    logger = setup_logging()
    
    try:
        # Test logging with extra fields
        test_extra = {"test_field": "test_value", "number": 123}
        logger.debug_with_extra("Test message", extra=test_extra)
        
        # Verify log file was created
        log_files = list(Path(temp_log_dir).glob('*.log'))
        assert len(log_files) == 1
        
        # Read the log file and verify content
        with open(log_files[0], 'r', encoding='utf-8') as f:
            log_content = f.read()
            assert "Test message" in log_content
            assert "test_value" in log_content
            assert "123" in log_content
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

def test_log_rotation(temp_log_dir, temp_config_file):
    """Test log file rotation."""
    # Create config file in temp directory
    config_path = Path(temp_log_dir) / 'config.yaml'
    with open(config_path, 'w') as f:
        f.write(f"""
logging:
  enable_file_logging: true
  log_dir: {temp_log_dir!r}
  max_file_size_mb: 0.001  # Very small size to trigger rotation
  backup_count: 2
""")
    
    # Setup logging with test directory
    os.environ['CONFIG_FILE'] = str(config_path)
    logger = setup_logging()
    
    try:
        # Generate enough logs to trigger rotation
        test_message = "Test rotation message " * 50  # About 1KB
        for _ in range(10):  # Should create multiple files due to rotation
            logger.debug(test_message)
            # Force flush the handlers
            for handler in logger.handlers:
                handler.flush()
        
        # Verify log files were rotated
        log_files = list(Path(temp_log_dir).glob('*.log*'))
        assert len(log_files) >= 2  # Should have at least original and one backup
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

def test_disable_file_logging(temp_log_dir, temp_config_file):
    """Test disabling file logging."""
    # Create config file in temp directory
    config_path = Path(temp_log_dir) / 'config.yaml'
    with open(config_path, 'w') as f:
        f.write(f"""
logging:
  enable_file_logging: false
  log_dir: {temp_log_dir!r}
""")
    
    # Setup logging
    os.environ['CONFIG_FILE'] = str(config_path)
    logger = setup_logging()
    
    try:
        # Log a message
        logger.debug("Test message")
        
        # Verify no log file was created
        log_files = list(Path(temp_log_dir).glob('*.log'))
        assert len(log_files) == 0
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

def test_log_levels(temp_log_dir, temp_config_file):
    """Test that log levels are properly set."""
    # Create config file in temp directory
    config_path = Path(temp_log_dir) / 'config.yaml'
    with open(config_path, 'w') as f:
        f.write(f"""
logging:
  enable_file_logging: true
  log_dir: {temp_log_dir!r}
""")
    
    # Setup logging
    os.environ['CONFIG_FILE'] = str(config_path)
    logger = setup_logging()
    
    try:
        # Test that third-party loggers are set to INFO
        assert logging.getLogger("yfinance").level == logging.INFO
        assert logging.getLogger("urllib3").level == logging.INFO
        assert logging.getLogger("peewee").level == logging.INFO
        assert logging.getLogger("google").level == logging.INFO
        
        # Test that application logger is set to DEBUG
        assert logging.getLogger("spreadsheet").level == logging.DEBUG
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

def test_json_serialization(temp_log_dir, temp_config_file):
    """Test that extra fields are properly JSON serialized."""
    # Create config file in temp directory
    config_path = Path(temp_log_dir) / 'config.yaml'
    with open(config_path, 'w') as f:
        f.write(f"""
logging:
  enable_file_logging: true
  log_dir: {temp_log_dir!r}
""")
    
    # Setup logging
    os.environ['CONFIG_FILE'] = str(config_path)
    logger = setup_logging()
    
    try:
        # Test with complex data structure
        complex_data = {
            "list": [1, 2, 3],
            "dict": {"key": "value"},
            "timestamp": "2024-04-11T12:00:00"
        }
        logger.debug_with_extra("Complex data test", extra=complex_data)
        
        # Verify log file content
        log_files = list(Path(temp_log_dir).glob('*.log'))
        assert len(log_files) == 1
        
        with open(log_files[0], 'r', encoding='utf-8') as f:
            log_content = f.read()
            # Verify JSON structure is present
            assert '"list": [1, 2, 3]' in log_content
            assert '"dict": {"key": "value"}' in log_content
            assert '"timestamp": "2024-04-11T12:00:00"' in log_content
    finally:
        # Clean up handlers
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler) 