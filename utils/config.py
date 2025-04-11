"""Configuration management utility for the application."""
from typing import Any, Dict, Optional
import os
import yaml
import logging
from pathlib import Path

class Config:
    """Singleton configuration manager that loads and provides access to config values."""
    
    _instance = None
    _config = None
    _config_path = None
    _logger = logging.getLogger(__name__)
    
    @classmethod
    def get_instance(cls, config_path: Optional[str] = None) -> 'Config':
        """
        Get singleton instance with optional config path override.
        
        Args:
            config_path: Optional path to config file. If not provided, uses:
                       1. CONFIG_FILE environment variable
                       2. Default 'config.yaml' in current directory
                       
        Returns:
            Config instance
        """
        if cls._instance is None or (config_path and config_path != cls._config_path):
            cls._instance = cls(config_path)
        return cls._instance
    
    def __init__(self, config_path: Optional[str] = None):
        """
        Initialize config from file.
        
        Args:
            config_path: Optional path to config file. If not provided, uses:
                       1. CONFIG_FILE environment variable
                       2. Default 'config.yaml' in current directory
        """
        if config_path is None:
            config_path = os.getenv('CONFIG_FILE', 'config.yaml')
        
        self._config_path = config_path
        self._load_config()
    
    def _load_config(self) -> None:
        """Load config from file."""
        try:
            with open(self._config_path, 'r') as f:
                self._config = yaml.safe_load(f)
            self._logger.info(f"Loaded config from {self._config_path}")
        except FileNotFoundError:
            self._logger.warning(f"Config file not found: {self._config_path}")
            self._config = {}
        except yaml.YAMLError as e:
            self._logger.error(f"Error loading config: {str(e)}")
            self._config = {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get config value by dot notation key.
        
        Args:
            key: Dot notation key (e.g., 'http_client.timeout')
            default: Default value if key not found
            
        Returns:
            Config value or default if not found
        """
        if not self._config:
            return default
            
        value = self._config
        for part in key.split('.'):
            if not isinstance(value, dict):
                return default
            value = value.get(part, default)
        return value
    
    def get_section(self, section: str) -> Dict:
        """
        Get entire config section.
        
        Args:
            section: Section name
            
        Returns:
            Section dictionary or empty dict if not found
        """
        return self.get(section, {})
    
    def reload(self) -> None:
        """Reload config from file."""
        self._load_config() 