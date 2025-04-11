"""Logging configuration module."""
import os
import logging
import logging.handlers
import json
from typing import Dict
from utils.config import Config

class ExtraFormatter(logging.Formatter):
    """Custom formatter that includes extra fields as JSON."""
    
    def format(self, record):
        """Format the log record with extra fields."""
        # Get the standard formatted message
        message = super().format(record)
        
        # Get extra fields from either direct attributes or nested 'extra' dict
        extra_fields = {}
        for key, value in record.__dict__.items():
            if key not in logging.LogRecord.__dict__ and key != 'extra':
                extra_fields[key] = value
        
        # Add nested extra fields if they exist
        if hasattr(record, 'extra'):
            if isinstance(record.extra, dict):
                extra_fields.update(record.extra)
        
        # Add extra fields if any exist
        if extra_fields:
            extra_str = json.dumps(extra_fields, default=str)
            message = f"{message} | Extra: {extra_str}"
        
        return message

def load_config() -> Dict:
    """
    Load logging configuration from config file.
    
    Returns:
        Dictionary containing logging configuration
    """
    config = Config.get_instance()
    return config.get_section('logging')

def setup_logging() -> logging.Logger:
    """
    Set up logging configuration.
    
    Returns:
        Root logger instance
    """
    config = load_config()
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        handler.close()
        logger.removeHandler(handler)
    
    # Configure console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    console_formatter = ExtraFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # Configure file handler if enabled
    if config.get('enable_file_logging', False):
        log_dir = config.get('log_dir', 'logs')
        os.makedirs(log_dir, exist_ok=True)
        
        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(log_dir, 'app.log'),
            maxBytes=int(config.get('max_file_size_mb', 1) * 1024 * 1024),
            backupCount=config.get('backup_count', 3)
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = ExtraFormatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    # Set log levels for third-party libraries
    logging.getLogger("yfinance").setLevel(logging.INFO)
    logging.getLogger("urllib3").setLevel(logging.INFO)
    logging.getLogger("peewee").setLevel(logging.INFO)
    logging.getLogger("google").setLevel(logging.INFO)
    
    # Set application loggers to DEBUG
    logging.getLogger("spreadsheet").setLevel(logging.DEBUG)
    
    return logger 