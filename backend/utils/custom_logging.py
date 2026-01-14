import logging
import logging.handlers
import json


def setup_logging():
    """Setup comprehensive logging configuration for the application."""
    
    class ExtraFormatter(logging.Formatter):
        def format(self, record):
            # List of standard LogRecord attributes
            standard_attrs = {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                'module', 'exc_info', 'exc_text', 'stack_info', 'lineno', 'funcName',
                'created', 'msecs', 'relativeCreated', 'thread', 'threadName', 'process',
                'processName', "taskName"
            }

            # Extract custom attributes
            extra_fields = {key: value for key, value in record.__dict__.items() if key not in standard_attrs}

            # Include standard attributes if the log level is ERROR
            if record.levelno == logging.ERROR:
                standard_fields = {key: getattr(record, key, None) for key in standard_attrs}
                extra_fields.update(standard_fields)

            if extra_fields:
                extra_str = json.dumps(extra_fields, default=str)
                record.msg = f"{record.msg} | Extra: {extra_str}"

            return super().format(record)

    # Create formatters
    console_formatter = ExtraFormatter(
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

    # Add a memory handler for testing purposes
    memory_handler = logging.handlers.MemoryHandler(capacity=1024*10, target=None)
    memory_handler.setFormatter(console_formatter)
    root_logger.addHandler(memory_handler)

    # Keep existing logger configurations from main.py
    logging.getLogger("yfinance").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.INFO)
    logging.getLogger("peewee").setLevel(logging.INFO)
    logging.getLogger("google").setLevel(logging.INFO)

    # Return both the logger and the memory handler for testing
    return root_logger, memory_handler