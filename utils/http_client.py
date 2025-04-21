"""HTTP client with retry and error handling capabilities."""
from typing import Optional, Any, Dict, List
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging
from .config import Config
import yaml

class HttpClientError(Exception):
    """Base exception for HTTP client errors."""
    pass

class RetryableError(HttpClientError):
    """Exception for errors that can be retried."""
    pass

class NonRetryableError(HttpClientError):
    """Exception for errors that should not be retried."""
    pass

class HttpClient:
    """HTTP client with built-in retry logic and error handling.
    
    This client provides a robust way to make HTTP requests with automatic retries
    for transient failures. It supports:
    - Configurable retry attempts with exponential backoff
    - Automatic retry for specific HTTP status codes
    - SSL error handling with retries
    - Connection error handling with retries
    - Timeout handling with retries
    
    Configuration can be provided through config.yaml under the 'http_client' section:
    - max_retries: Number of retry attempts (default: 3)
    - timeout_seconds: Request timeout in seconds (default: 60)
    - backoff_factor: Exponential backoff factor (default: 0.5)
    - retry_statuses: List of HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504])
    - page_size: Number of items to return per request (default: 10)
    """
    
    @classmethod
    def from_config(cls, logger: Optional[logging.Logger] = None) -> 'HttpClient':
        """Create an HttpClient instance from configuration.
        
        Args:
            logger: Optional logger instance for warning messages
            
        Returns:
            HttpClient instance with configured settings
        """
        try:
            with open('config.yaml', 'r') as f:
                config = yaml.safe_load(f)
        except FileNotFoundError:
            if logger:
                logger.warning("No config.yaml found, using default HTTP client settings")
            return cls(
                max_retries=3,
                timeout_seconds=60,
                backoff_factor=0.5,
                retry_statuses=[408, 429, 500, 502, 503, 504],
                page_size=10
            )

        http_config = config.get('http_client', {})
        if not http_config and logger:
            logger.warning("No http_client configuration found in config.yaml, using default settings")

        return cls(
            max_retries=http_config.get('max_retries', 3),
            timeout_seconds=http_config.get('timeout_seconds', 60),
            backoff_factor=http_config.get('backoff_factor', 0.5),
            retry_statuses=http_config.get('retry_statuses', [408, 429, 500, 502, 503, 504]),
            page_size=http_config.get('page_size', 10)
        )
    
    def __init__(self, max_retries: int = 3, timeout_seconds: int = 60, backoff_factor: float = 0.5, 
                 retry_statuses: List[int] = [408, 429, 500, 502, 503, 504], page_size: int = 10):
        """
        Initialize HTTP client with retry settings.
        
        Args:
            max_retries: Maximum number of retries for failed requests
            timeout_seconds: Request timeout in seconds
            backoff_factor: Factor to apply between retries (exponential backoff)
            retry_statuses: List of HTTP status codes to retry on
            page_size: Number of items to return per request
        """
        self.logger = logging.getLogger(__name__)
        self.max_retries = max_retries
        self.timeout_seconds = timeout_seconds
        self.backoff_factor = backoff_factor
        self.retry_statuses = retry_statuses
        self.page_size = page_size
        self.session = self._create_session()
        
        self.logger.info(
            "Initialized HTTP client",
            extra={
                "max_retries": max_retries,
                "timeout_seconds": timeout_seconds,
                "backoff_factor": backoff_factor,
                "retry_statuses": retry_statuses,
                "page_size": page_size
            }
        )
    
    def _create_session(self):
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=self.backoff_factor,
            status_forcelist=self.retry_statuses,
            allowed_methods=["GET"],  # Only retry GET requests
            raise_on_status=True,  # Raise exceptions for HTTP errors
            raise_on_redirect=True,  # Raise exceptions for redirects
            respect_retry_after_header=True,  # Honor Retry-After headers
            # Retry on connection errors and timeouts
            connect=self.max_retries,
            read=self.max_retries
        )
        
        session = requests.Session()
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def get(self, url: str, params: Optional[Dict] = None) -> Any:
        """
        Perform GET request with retry and error handling.
        
        Args:
            url: URL to request
            params: Optional query parameters
            
        Returns:
            Parsed JSON response
            
        Raises:
            RetryableError: For errors that can be retried and all retries were exhausted
            NonRetryableError: For errors that should not be retried
        """
        retries = 0
        while True:
            try:
                response = self.session.get(url, params=params, timeout=self.timeout_seconds)
                response.raise_for_status()
                return response.json()
                
            except requests.exceptions.HTTPError as e:
                if e.response and e.response.status_code >= 500:
                    if retries < self.max_retries:
                        retries += 1
                        continue
                    raise RetryableError(f"Server error after all retries: {str(e)}") from e
                raise NonRetryableError(f"Client error: {str(e)}") from e
                
            except (requests.exceptions.ConnectionError,
                    requests.exceptions.Timeout,
                    requests.exceptions.SSLError) as e:
                if retries < self.max_retries:
                    retries += 1
                    continue
                raise RetryableError(f"Network error after all retries: {str(e)}") from e
                
            except requests.exceptions.RequestException as e:
                raise NonRetryableError(f"Request failed: {str(e)}") from e
                
            except ValueError as e:
                raise NonRetryableError(f"Invalid JSON response: {str(e)}") from e
    
    def close(self):
        """Close the session."""
        self.session.close() 