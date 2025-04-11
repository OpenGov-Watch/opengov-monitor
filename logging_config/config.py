import logging
import logging.handlers
import os
from datetime import datetime
import json
import yaml

def load_config():
    """Load configuration from config.yaml"""
    config_file = os.getenv('CONFIG_FILE', 'config.yaml')
    with open(config_file, 'r') as f:
        return yaml.safe_load(f)

def setup_logging():
    """Setup comprehensive logging configuration for the application."""
    config = load_config()
    logging_config = config.get('logging', {})
    
    # Create logs directory if it doesn't exist
    log_dir = logging_config.get('log_dir', 'logs')
    os.makedirs(log_dir, exist_ok=True)

    class ExtraFormatter(logging.Formatter):
        def format(self, record):
            # Convert extra fields to JSON string if they exist
            if hasattr(record, 'extra'):
                extra_str = json.dumps(record.extra, default=str)
                record.msg = f"{record.msg} | Extra: {extra_str}"
            return super().format(record)

    # Create formatters
    console_formatter = ExtraFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    file_formatter = ExtraFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Console handler (existing setup)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(logging.DEBUG)

    # Update root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        handler.close()
        root_logger.removeHandler(handler)
    
    # Add console handler
    root_logger.addHandler(console_handler)

    # Add file handler if enabled
    if logging_config.get('enable_file_logging', True):
        max_bytes = logging_config.get('max_file_size_mb', 10) * 1024 * 1024
        backup_count = logging_config.get('backup_count', 5)
        
        file_handler = logging.handlers.RotatingFileHandler(
            os.path.join(log_dir, f'spreadsheet_operations.log'),
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(logging.DEBUG)
        root_logger.addHandler(file_handler)

    # Keep existing logger configurations from main.py
    logging.getLogger("yfinance").setLevel(logging.INFO)
    logging.getLogger("urllib3").setLevel(logging.INFO)
    logging.getLogger("peewee").setLevel(logging.INFO)
    logging.getLogger("google").setLevel(logging.INFO)

    # Add custom loggers for our application
    spreadsheet_logger = logging.getLogger("spreadsheet")
    spreadsheet_logger.setLevel(logging.DEBUG)
    spreadsheet_logger.propagate = True

    # Create a wrapper function to handle extra fields
    def log_with_extra(level, msg, *args, extra=None, **kwargs):
        if extra:
            record = logging.LogRecord(
                name=root_logger.name,
                level=level,
                pathname="",
                lineno=0,
                msg=msg,
                args=args,
                exc_info=None,
                func=None
            )
            record.extra = extra
            for handler in root_logger.handlers:
                handler.handle(record)
        else:
            root_logger.log(level, msg, *args, **kwargs)

    # Add the wrapper methods to the logger
    root_logger.debug_with_extra = lambda msg, *args, **kwargs: log_with_extra(logging.DEBUG, msg, *args, **kwargs)
    root_logger.info_with_extra = lambda msg, *args, **kwargs: log_with_extra(logging.INFO, msg, *args, **kwargs)
    root_logger.warning_with_extra = lambda msg, *args, **kwargs: log_with_extra(logging.WARNING, msg, *args, **kwargs)
    root_logger.error_with_extra = lambda msg, *args, **kwargs: log_with_extra(logging.ERROR, msg, *args, **kwargs)
    root_logger.critical_with_extra = lambda msg, *args, **kwargs: log_with_extra(logging.CRITICAL, msg, *args, **kwargs)

    return root_logger 