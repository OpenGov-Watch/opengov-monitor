import pytest
import pandas as pd
from datetime import datetime
from data_sinks.google import utils

def test_format_date():
    """Test the format_date function with various inputs."""
    # Test valid date
    timestamp = pd.Timestamp('2024-04-11')
    result = utils.format_date(timestamp)
    expected = (timestamp.date() - datetime(1900, 1, 1).date()).days
    assert result == expected

    # Test null date
    with pytest.raises(ValueError, match="Timestamp cannot be null when formatting date"):
        utils.format_date(pd.NaT)

def test_extract_id():
    """Test the extract_id function with various inputs."""
    # Test valid hyperlink
    url = '=HYPERLINK("https://example.com/123", 123)'
    assert utils.extract_id(url) == "123"

    # Test integer input
    assert utils.extract_id(42) is None

    # Test invalid format
    assert utils.extract_id("not a hyperlink") is None

    # Test empty string
    assert utils.extract_id("") is None

def test_create_filter_request():
    """Test the create_filter_request function."""
    worksheet_id = "test-worksheet-id"
    result = utils.create_filter_request(worksheet_id)
    
    assert result["setBasicFilter"]["filter"]["range"]["sheetId"] == worksheet_id
    assert result["setBasicFilter"]["filter"]["range"]["startRowIndex"] == 0
    assert result["setBasicFilter"]["filter"]["range"]["startColumnIndex"] == 0

def test_create_sort_request():
    """Test the create_sort_request function."""
    worksheet_id = "test-worksheet-id"
    col_count = 5
    result = utils.create_sort_request(worksheet_id, col_count)
    
    assert result["sortRange"]["range"]["sheetId"] == worksheet_id
    assert result["sortRange"]["range"]["endColumnIndex"] == col_count
    assert result["sortRange"]["range"]["startRowIndex"] == 1
    assert result["sortRange"]["range"]["startColumnIndex"] == 0
    assert result["sortRange"]["sortSpecs"][0]["dimensionIndex"] == 0
    assert result["sortRange"]["sortSpecs"][0]["sortOrder"] == "DESCENDING" 