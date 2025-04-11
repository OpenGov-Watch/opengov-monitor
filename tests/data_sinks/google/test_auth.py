import pytest
from unittest.mock import Mock, patch
from data_sinks.google.auth import GoogleAuth
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend

@pytest.fixture
def mock_credentials():
    """Create mock credentials with a dynamically generated private key."""
    # Generate a temporary RSA key pair
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Convert private key to PEM format
    private_key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    return {
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "key-id",
        "private_key": private_key_pem,
        "client_email": "test@example.com",
        "client_id": "client-id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40example.com"
    }

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

def test_init_valid_credentials(mock_credentials):
    """Test initialization with valid credentials."""
    auth = GoogleAuth(mock_credentials)
    assert auth.credentials == mock_credentials
    assert auth._gc is None

def test_init_invalid_credentials_not_dict():
    """Test initialization with invalid credentials (not a dictionary)."""
    with pytest.raises(AttributeError, match="Credentials must be a dictionary"):
        GoogleAuth("not-a-dict")

def test_init_invalid_credentials_no_type():
    """Test initialization with invalid credentials (no type field)."""
    with pytest.raises(AttributeError, match="Credentials must contain 'type' field"):
        GoogleAuth({})

@patch('google.oauth2.service_account.Credentials.from_service_account_info')
@patch('gspread.authorize')
def test_connect(mock_authorize, mock_from_service_account_info, mock_credentials):
    """Test successful connection."""
    # Setup mocks
    mock_creds = Mock()
    mock_from_service_account_info.return_value = mock_creds
    mock_client = Mock()
    mock_authorize.return_value = mock_client

    # Test connection
    auth = GoogleAuth(mock_credentials)
    result = auth.connect()

    # Verify calls
    mock_from_service_account_info.assert_called_once_with(
        mock_credentials,
        scopes=[
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
    )
    mock_authorize.assert_called_once_with(mock_creds)
    assert result == mock_client
    assert auth._gc == mock_client

def test_client_not_connected():
    """Test accessing client before connecting."""
    auth = GoogleAuth({"type": "service_account"})
    with pytest.raises(RuntimeError, match="Not connected to Google Sheets"):
        _ = auth.client

@patch('google.oauth2.service_account.Credentials.from_service_account_info')
@patch('gspread.authorize')
def test_client_connected(mock_authorize, mock_from_service_account_info, mock_credentials):
    """Test accessing client after connecting."""
    # Setup mocks
    mock_creds = Mock()
    mock_from_service_account_info.return_value = mock_creds
    mock_client = Mock()
    mock_authorize.return_value = mock_client

    # Test client access
    auth = GoogleAuth(mock_credentials)
    auth.connect()
    assert auth.client == mock_client 