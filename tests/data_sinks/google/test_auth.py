import pytest
from unittest.mock import Mock, patch
from data_sinks.google.auth import GoogleAuth

def test_auth_initialization(sample_credentials):
    """Test GoogleAuth initialization."""
    auth = GoogleAuth(sample_credentials)
    assert auth.credentials == sample_credentials
    assert auth._gc is None
    assert auth._logger.name == "data_sinks.google.auth"

def test_auth_initialization_with_invalid_credentials():
    """Test GoogleAuth initialization with invalid credentials."""
    with pytest.raises(AttributeError):
        GoogleAuth(None)
    
    with pytest.raises(AttributeError):
        GoogleAuth("not a dict")

def test_auth_initialization_with_missing_type():
    """Test GoogleAuth initialization with missing type field."""
    with pytest.raises(AttributeError, match="Credentials must contain 'type' field"):
        GoogleAuth({})  # Dictionary without 'type' field

def test_auth_connect(sample_credentials):
    """Test the connect method."""
    with patch('data_sinks.google.auth.Credentials.from_service_account_info') as mock_creds, \
         patch('data_sinks.google.auth.gspread.authorize') as mock_authorize:
        
        # Setup mocks
        mock_creds.return_value = Mock()
        mock_authorize.return_value = Mock()
        
        # Test connection
        auth = GoogleAuth(sample_credentials)
        client = auth.connect()
        
        # Verify calls
        mock_creds.assert_called_once_with(
            sample_credentials,
            scopes=['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        )
        mock_authorize.assert_called_once_with(mock_creds.return_value)
        assert auth._gc == mock_authorize.return_value
        assert client == mock_authorize.return_value

def test_auth_client_property_without_connection(sample_credentials):
    """Test client property when not connected."""
    auth = GoogleAuth(sample_credentials)
    with pytest.raises(RuntimeError, match="Not connected to Google Sheets"):
        _ = auth.client

def test_auth_client_property_with_connection(sample_credentials):
    """Test client property when connected."""
    with patch('data_sinks.google.auth.Credentials.from_service_account_info'), \
         patch('data_sinks.google.auth.gspread.authorize') as mock_authorize:
        
        mock_client = Mock()
        mock_authorize.return_value = mock_client
        
        auth = GoogleAuth(sample_credentials)
        auth.connect()
        
        assert auth.client == mock_client

def test_auth_connect_error_handling(sample_credentials):
    """Test error handling in connect method."""
    with patch('data_sinks.google.auth.Credentials.from_service_account_info') as mock_creds:
        mock_creds.side_effect = Exception("Authentication failed")
        
        auth = GoogleAuth(sample_credentials)
        with pytest.raises(Exception, match="Authentication failed"):
            auth.connect()
        
        assert auth._gc is None 