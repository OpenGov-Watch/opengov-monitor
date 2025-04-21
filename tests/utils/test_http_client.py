"""Tests for the HttpClient class."""
import pytest
from unittest.mock import Mock, patch
import requests
from utils.http_client import HttpClient, RetryableError, NonRetryableError
import logging

@pytest.fixture
def mock_response():
    """Create a mock response object."""
    response = Mock()
    response.json.return_value = {"test": "data"}
    response.status_code = 200
    response.raise_for_status.return_value = None
    return response

@pytest.fixture
def mock_session(mock_response):
    """Create a mock session object."""
    session = Mock()
    session.get.return_value = mock_response
    return session

@pytest.fixture
def logger():
    """Create a logger for testing."""
    return logging.getLogger(__name__)

def test_from_config_defaults(logger):
    """Test HttpClient initialization with default config."""
    with patch('builtins.open', side_effect=FileNotFoundError()):
        client = HttpClient.from_config(logger=logger)
        assert client.max_retries == 3
        assert client.timeout_seconds == 60
        assert client.backoff_factor == 0.5
        assert client.retry_statuses == [408, 429, 500, 502, 503, 504]
        assert client.page_size == 10

def test_from_config_custom(logger):
    """Test HttpClient initialization with custom config."""
    config = {
        "max_retries": 5,
        "timeout_seconds": 30,
        "retry_statuses": [500, 503]
    }
    client = HttpClient(
        max_retries=config["max_retries"],
        timeout_seconds=config["timeout_seconds"],
        retry_statuses=config["retry_statuses"]
    )
    assert client.max_retries == 5
    assert client.timeout_seconds == 30
    assert client.retry_statuses == [500, 503]

def test_successful_request(mock_session, logger):
    """Test successful request handling."""
    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        mock_session.get.return_value = Mock(
            json=lambda: {"test": "data"},
            raise_for_status=lambda: None
        )
        response = client.get("https://example.com")
        assert response == {"test": "data"}

def test_retry_on_error(mock_session, logger):
    """Test retry behavior on error."""
    # First two calls fail with connection error, third succeeds
    mock_session.get.side_effect = [
        requests.exceptions.ConnectionError(),
        requests.exceptions.ConnectionError(),
        Mock(json=lambda: {"test": "data"}, raise_for_status=lambda: None)
    ]

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=2)
        response = client.get("https://example.com")
        assert response == {"test": "data"}
        assert mock_session.get.call_count == 3

def test_max_retries_exceeded(mock_session, logger):
    """Test behavior when max retries are exceeded."""
    mock_session.get.side_effect = requests.exceptions.ConnectionError()

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=2)
        with pytest.raises(RetryableError):
            client.get("https://example.com")
        assert mock_session.get.call_count == 3

def test_retry_on_status_code(mock_session, logger):
    """Test retry behavior on specific status codes."""
    def raise_for_status_500():
        raise requests.exceptions.HTTPError(response=Mock(status_code=500))

    def raise_for_status_503():
        raise requests.exceptions.HTTPError(response=Mock(status_code=503))

    responses = [
        Mock(status_code=500, json=lambda: {"error": "server error"}, raise_for_status=raise_for_status_500),
        Mock(status_code=503, json=lambda: {"error": "service unavailable"}, raise_for_status=raise_for_status_503),
        Mock(status_code=200, json=lambda: {"test": "data"}, raise_for_status=lambda: None)
    ]
    mock_session.get.side_effect = responses

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=2)
        response = client.get("https://example.com")
        assert response == {"test": "data"}
        assert mock_session.get.call_count == 3

def test_non_retryable_status_code(mock_session, logger):
    """Test behavior for non-retryable status codes."""
    def raise_for_status_404():
        raise requests.exceptions.HTTPError(response=Mock(status_code=404))

    mock_session.get.return_value = Mock(
        status_code=404,
        json=lambda: {"error": "not found"},
        raise_for_status=raise_for_status_404
    )

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        with pytest.raises(NonRetryableError):
            client.get("https://example.com")
        assert mock_session.get.call_count == 1

def test_invalid_json_response(mock_session, logger):
    """Test handling of invalid JSON responses."""
    mock_session.get.return_value = Mock(
        raise_for_status=lambda: None,
        json=Mock(side_effect=ValueError("Invalid JSON"))
    )

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        with pytest.raises(NonRetryableError):
            client.get("https://example.com")
        assert mock_session.get.call_count == 1

def test_ssl_error_retry(mock_session, logger):
    """Test retry behavior on SSL errors."""
    mock_session.get.side_effect = [
        requests.exceptions.SSLError(),
        Mock(json=lambda: {"test": "data"}, raise_for_status=lambda: None)
    ]

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=1)
        response = client.get("https://example.com")
        assert response == {"test": "data"}
        assert mock_session.get.call_count == 2

def test_connection_error_retry(mock_session, logger):
    """Test retry behavior on connection errors."""
    mock_session.get.side_effect = [
        requests.exceptions.ConnectionError(),
        Mock(json=lambda: {"test": "data"}, raise_for_status=lambda: None)
    ]

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=1)
        response = client.get("https://example.com")
        assert response == {"test": "data"}
        assert mock_session.get.call_count == 2 