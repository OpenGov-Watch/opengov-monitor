"""
SQLite logging handler with batching support.

Writes log records to a SQLite database table with configurable batching
to handle log bursts efficiently.
"""

import atexit
import logging
import sqlite3
import json
import threading
import time
from datetime import datetime
from pathlib import Path


class SQLiteHandler(logging.Handler):
    """Logging handler that writes to SQLite database with batching."""

    def __init__(self, db_path="logs.db", batch_size=50, flush_interval=5.0):
        """
        Args:
            db_path: Path to SQLite database file
            batch_size: Number of records to batch before writing
            flush_interval: Max seconds to wait before flushing batch
        """
        super().__init__()
        self.db_path = db_path
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self._buffer = []
        self._lock = threading.Lock()
        self._last_flush = time.time()
        self._ensure_table()

        # Register atexit handler to ensure logs are flushed on process exit
        atexit.register(self.flush)

    def _ensure_table(self):
        """Create logs table if it doesn't exist."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                source TEXT NOT NULL,
                log_level TEXT NOT NULL,
                content TEXT NOT NULL,
                extra TEXT
            )
        ''')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(log_level)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source)')
        conn.commit()
        conn.close()

    def _prepare_record(self, record):
        """Convert log record to tuple for database insert."""
        standard_attrs = {
            'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
            'filename', 'module', 'exc_info', 'exc_text', 'stack_info',
            'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
            'thread', 'threadName', 'process', 'processName', 'taskName',
            'message'
        }
        extra = {k: v for k, v in record.__dict__.items()
                 if k not in standard_attrs}
        extra_json = json.dumps(extra, default=str) if extra else None
        timestamp = datetime.fromtimestamp(record.created).isoformat()
        content = record.getMessage()
        return (timestamp, record.name, record.levelname, content, extra_json)

    def _flush(self):
        """Write buffered records to database."""
        if not self._buffer:
            return

        try:
            conn = sqlite3.connect(self.db_path)
            conn.executemany(
                'INSERT INTO logs (timestamp, source, log_level, content, extra) VALUES (?, ?, ?, ?, ?)',
                self._buffer
            )
            conn.commit()
            conn.close()
            self._buffer = []
            self._last_flush = time.time()
        except Exception:
            # On error, keep buffer for retry
            pass

    def emit(self, record):
        """Add log record to buffer, flush if needed."""
        try:
            row = self._prepare_record(record)

            with self._lock:
                self._buffer.append(row)

                # Flush if batch full or interval elapsed
                should_flush = (
                    len(self._buffer) >= self.batch_size or
                    time.time() - self._last_flush >= self.flush_interval
                )
                if should_flush:
                    self._flush()
        except Exception:
            self.handleError(record)

    def flush(self):
        """Force flush all buffered records."""
        with self._lock:
            self._flush()

    def close(self):
        """Flush remaining records and close handler."""
        self.flush()
        super().close()
