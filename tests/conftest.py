import pytest
import pandas as pd
from datetime import datetime

@pytest.fixture(autouse=True)
def no_external_calls(monkeypatch):
    """Prevent any unintended external calls during testing."""
    def mock_connect(*args, **kwargs):
        raise RuntimeError("External connections not allowed in tests")
    
    monkeypatch.setattr("gspread.authorize", mock_connect)

@pytest.fixture
def sample_credentials():
    """Sample Google service account credentials for testing."""
    return {
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": "test-key",
        "client_email": "test@example.com",
        "client_id": "test-client-id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40example.com"
    }

@pytest.fixture
def sample_df():
    """Sample DataFrame for testing."""
    return pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/1", 1)'],
        'proposal_time': [pd.Timestamp('2024-04-11')],
        'DOT': [100.5],
        'latest_status_change': [pd.Timestamp('2024-04-10')]
    })

@pytest.fixture
def sample_worksheet():
    """Mock worksheet object for testing."""
    class MockWorksheet:
        def __init__(self):
            self.id = "test-worksheet-id"
            self.row_count = 100
            self.col_count = 5
            self.spreadsheet = type('MockSpreadsheet', (), {'batch_update': lambda self, body: None})()
    
    return MockWorksheet() 