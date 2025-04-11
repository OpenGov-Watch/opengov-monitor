from google.oauth2.service_account import Credentials
import gspread
import logging

class GoogleAuth:
    """Handle Google Sheets authentication."""
    
    def __init__(self, credentials_file):
        if not isinstance(credentials_file, dict):
            raise AttributeError("Credentials must be a dictionary")
        if "type" not in credentials_file:
            raise AttributeError("Credentials must contain 'type' field")
        self.credentials = credentials_file
        self._gc = None
        self._logger = logging.getLogger(__name__)
    
    def connect(self):
        """Connect to Google Sheets."""
        scope = [
            'https://spreadsheets.google.com/feeds',
            'https://www.googleapis.com/auth/drive'
        ]
        creds = Credentials.from_service_account_info(
            self.credentials,
            scopes=scope
        )
        self._gc = gspread.authorize(creds)
        return self._gc
    
    @property
    def client(self):
        if not self._gc:
            raise RuntimeError("Not connected to Google Sheets")
        return self._gc 