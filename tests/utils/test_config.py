"""Unit tests for the Config class."""
import os
import pytest
import yaml
from pathlib import Path
from unittest.mock import patch, mock_open
from utils.config import Config

@pytest.fixture
def temp_config_file(tmp_path):
    """Create a temporary config file."""
    config_path = tmp_path / "config.yaml"
    config_data = {
        "http_client": {
            "max_retries": 3,
            "timeout_seconds": 60
        },
        "logging": {
            "level": "INFO",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        }
    }
    with open(config_path, 'w') as f:
        yaml.dump(config_data, f)
    return config_path

def test_singleton_instance():
    """Test that Config maintains a single instance."""
    config1 = Config.get_instance()
    config2 = Config.get_instance()
    assert config1 is config2

def test_config_path_override():
    """Test that config path override creates new instance."""
    config1 = Config.get_instance("config1.yaml")
    config2 = Config.get_instance("config2.yaml")
    assert config1 is not config2

def test_environment_override(temp_config_file):
    """Test that CONFIG_FILE env var overrides default path."""
    # Clear any existing instance
    Config._instance = None
    
    with patch.dict(os.environ, {'CONFIG_FILE': str(temp_config_file)}):
        config = Config.get_instance()
        assert config.get("http_client.max_retries") == 3

def test_get_with_dot_notation(temp_config_file):
    """Test getting nested config values with dot notation."""
    config = Config.get_instance(str(temp_config_file))
    assert config.get("http_client.max_retries") == 3
    assert config.get("http_client.timeout_seconds") == 60
    assert config.get("logging.level") == "INFO"

def test_get_section(temp_config_file):
    """Test getting entire config sections."""
    config = Config.get_instance(str(temp_config_file))
    http_config = config.get_section("http_client")
    assert http_config == {
        "max_retries": 3,
        "timeout_seconds": 60
    }

def test_missing_config():
    """Test behavior when config file is missing."""
    config = Config.get_instance("nonexistent.yaml")
    assert config.get("any.key") is None
    assert config.get_section("any") == {}

def test_invalid_yaml():
    """Test behavior with invalid YAML file."""
    invalid_yaml = "invalid: yaml: {"
    with patch("builtins.open", mock_open(read_data=invalid_yaml)):
        config = Config.get_instance("invalid.yaml")
        assert config.get("any.key") is None
        assert config.get_section("any") == {}

def test_reload(temp_config_file):
    """Test config reload functionality."""
    config = Config.get_instance(str(temp_config_file))
    assert config.get("http_client.max_retries") == 3
    
    # Modify the config file
    new_config = {
        "http_client": {
            "max_retries": 5
        }
    }
    with open(temp_config_file, 'w') as f:
        yaml.dump(new_config, f)
    
    # Reload and verify changes
    config.reload()
    assert config.get("http_client.max_retries") == 5 