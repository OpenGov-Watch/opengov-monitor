"""HTTP client with retry and error handling capabilities."""
from typing import Optional, Any, Dict
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging
from .config import Config

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
    """
    
    @classmethod
    def from_config(cls, config_path: str = "config.yaml", logger: Optional[logging.Logger] = None) -> 'HttpClient':
        """
        Create HttpClient instance from config file.
        
        Args:
            config_path: Path to config file
            logger: Optional logger instance
            
        Returns:
            HttpClient instance configured from file
        """
        config = Config.get_instance(config_path)
        http_config = config.get_section('http_client')
        
        # Log warning if using default values
        if not http_config:
            if logger:
                logger.warning("No HTTP client configuration found in config file. Using default values.")
            return cls(logger=logger)
        
        # Log warning if any default values are used
        defaults = {
            'max_retries': 3,
            'timeout_seconds': 60,
            'backoff_factor': 0.5,
            'retry_statuses': [408, 429, 500, 502, 503, 504]
        }
        for key, default in defaults.items():
            if key not in http_config:
                if logger:
                    logger.warning(f"Using default value for {key}: {default}")
        
        return cls(
            max_retries=http_config.get('max_retries', defaults['max_retries']),
            timeout=http_config.get('timeout_seconds', defaults['timeout_seconds']),
            backoff_factor=http_config.get('backoff_factor', defaults['backoff_factor']),
            retry_statuses=http_config.get('retry_statuses', defaults['retry_statuses']),
            logger=logger
        )
    
    def __init__(self, 
                 max_retries: int = 3,
                 backoff_factor: float = 0.5,
                 retry_statuses: Optional[list[int]] = None,
                 timeout: int = 60,
                 logger: Optional[logging.Logger] = None):
        """
        Initialize HTTP client with retry settings.
        
        Args:
            max_retries: Maximum number of retries for failed requests
            backoff_factor: Factor to apply between retries (exponential backoff)
            retry_statuses: List of HTTP status codes to retry on
            timeout: Request timeout in seconds
            logger: Logger instance to use
        """
        self.logger = logger or logging.getLogger(__name__)
        self.timeout = timeout
        self.max_retries = max_retries
        
        if retry_statuses is None:
            retry_statuses = [408, 429, 500, 502, 503, 504]
            
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=retry_statuses,
            allowed_methods=["GET"],  # Only retry GET requests
            raise_on_status=True,  # Raise exceptions for HTTP errors
            raise_on_redirect=True,  # Raise exceptions for redirects
            respect_retry_after_header=True,  # Honor Retry-After headers
            # Retry on connection errors and timeouts
            connect=max_retries,
            read=max_retries
        )
        
        self.session = requests.Session()
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.logger.info(
            "Initialized HTTP client",
            extra={
                "max_retries": max_retries,
                "timeout": timeout,
                "backoff_factor": backoff_factor,
                "retry_statuses": retry_statuses
            }
        )
    
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
                response = self.session.get(url, params=params, timeout=self.timeout)
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