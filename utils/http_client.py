"""HTTP client with retry and error handling capabilities."""
from typing import Optional, Any, Dict
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging
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
    """HTTP client with retry and error handling capabilities."""
    
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
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        
        http_config = config.get('http_client', {})
        return cls(
            max_retries=http_config.get('max_retries', 3),
            timeout=http_config.get('timeout_seconds', 60),
            backoff_factor=http_config.get('backoff_factor', 0.5),
            retry_statuses=http_config.get('retry_statuses', [408, 429, 500, 502, 503, 504]),
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
        
        if retry_statuses is None:
            retry_statuses = [408, 429, 500, 502, 503, 504]
            
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=retry_statuses,
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
        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code >= 500:
                raise RetryableError(f"Server error after all retries: {str(e)}") from e
            raise NonRetryableError(f"Client error: {str(e)}") from e
            
        except (requests.exceptions.ConnectionError,
                requests.exceptions.Timeout) as e:
            # These errors have already been retried by urllib3's Retry strategy
            raise RetryableError(f"Network error after all retries: {str(e)}") from e
            
        except requests.exceptions.RequestException as e:
            raise NonRetryableError(f"Request failed: {str(e)}") from e
            
        except ValueError as e:
            raise NonRetryableError(f"Invalid JSON response: {str(e)}") from e
    
    def close(self):
        """Close the session."""
        self.session.close() 