"""Tests for the HTTP client implementation."""
import pytest
import requests
from unittest.mock import Mock, patch
import yaml
import tempfile
import os
from utils.http_client import HttpClient, RetryableError, NonRetryableError

@pytest.fixture
def mock_response():
    """Create a mock response object."""
    response = Mock()
    response.json.return_value = {"key": "value"}
    return response

@pytest.fixture
def mock_session(mock_response):
    """Create a mock session object."""
    session = Mock()
    session.get.return_value = mock_response
    return session

@pytest.fixture
def config_file():
    """Create a temporary config file."""
    config = {
        "http_client": {
            "max_retries": 3,
            "timeout_seconds": 60,
            "backoff_factor": 0.5,
            "retry_statuses": [408, 429, 500, 502, 503, 504]
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        yaml.dump(config, f)
        return f.name

def test_from_config(config_file):
    """Test creating HttpClient from config file."""
    client = HttpClient.from_config(config_file)
    assert client.timeout == 60
    os.unlink(config_file)

def test_successful_request(mock_session):
    """Test successful GET request."""
    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        response = client.get("http://example.com")
        assert response == {"key": "value"}
        mock_session.get.assert_called_once_with(
            "http://example.com",
            params=None,
            timeout=60
        )

def test_retryable_error(mock_session):
    """Test handling of retryable errors."""
    # Mock the session's get method to raise connection errors for all retries
    mock_session.get.side_effect = requests.exceptions.ConnectionError("Connection refused")

    with patch('requests.Session', return_value=mock_session):
        client = HttpClient(max_retries=1)
        with pytest.raises(RetryableError) as exc_info:
            client.get("http://example.com")
        
        assert "Network error after all retries" in str(exc_info.value)
        # The retry is handled by urllib3, so we only see one call at the requests level
        assert mock_session.get.call_count == 1

def test_non_retryable_error(mock_session):
    """Test handling of non-retryable errors."""
    mock_session.get.side_effect = requests.exceptions.HTTPError(
        "400 Bad Request",
        response=Mock(status_code=400)
    )
    
    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        with pytest.raises(NonRetryableError):
            client.get("http://example.com")
        assert mock_session.get.call_count == 1  # No retries for non-retryable errors

def test_invalid_json(mock_session):
    """Test handling of invalid JSON responses."""
    mock_response = Mock()
    mock_response.json.side_effect = ValueError("Invalid JSON")
    mock_session.get.return_value = mock_response
    
    with patch('requests.Session', return_value=mock_session):
        client = HttpClient()
        with pytest.raises(NonRetryableError):
            client.get("http://example.com")

def test_close():
    """Test session cleanup."""
    with patch('requests.Session') as mock_session:
        client = HttpClient()
        client.close()
        mock_session.return_value.close.assert_called_once() 