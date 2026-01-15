"""
Abstract base class for data sinks.

Defines the common interface that all data sinks must implement,
enabling easy swapping between different storage backends.
"""

from abc import ABC, abstractmethod
import pandas as pd
from typing import List, Optional


class DataSink(ABC):
    """Abstract base class for all data sinks.

    Data sinks receive transformed DataFrames and persist them to storage.
    Implementations must handle connection management, upsert operations,
    and proper resource cleanup.
    """

    @abstractmethod
    def connect(self) -> None:
        """Establish connection to the data sink.

        Must be called before any data operations.
        """
        pass

    @abstractmethod
    def update_table(
        self,
        name: str,
        df: pd.DataFrame,
        allow_empty: bool = False,
    ) -> None:
        """Update a table with new data using upsert semantics.

        Args:
            name: Name of the table to update.
            df: DataFrame containing the data to upsert.
                The DataFrame index is used as the primary key.
            allow_empty: Whether to allow empty DataFrame input.
        """
        pass

    @abstractmethod
    def close(self) -> None:
        """Close the connection and cleanup resources."""
        pass

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
        return False
