import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
from data_sinks.google.spreadsheet import SpreadsheetSink

class TestSpreadsheetSink(unittest.TestCase):
    
    @patch('data_sinks.google.spreadsheet.GoogleAuth')
    @patch('data_sinks.google.spreadsheet.utils')
    def test_process_deltas(self, mock_utils, mock_google_auth):
        # Mock data
        df = pd.DataFrame({"id": ["1", "2"], "value": ["A", "B"]}).set_index("id")
        sheet_df = pd.DataFrame({"id": ["2", "3"], "value": ["B", "C"]}).set_index("id")

        # Initialize SpreadsheetSink
        sink = SpreadsheetSink(credentials_file="dummy_credentials.json")

        # Call the method
        update_df, append_df = sink._process_deltas(df, sheet_df)

        # Assert the authoritative behavior
        self.assertEqual(len(update_df), 1)
        self.assertEqual(len(append_df), 1)
        self.assertIn("2", update_df.index)
        self.assertIn("1", append_df.index)

if __name__ == "__main__":
    unittest.main()