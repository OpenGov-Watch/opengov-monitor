import pytest
import pandas as pd
from datetime import datetime, date
from data_sinks.google.utils import (
    format_date, extract_id, create_filter_request, create_sort_request
)

def test_format_date_valid():
    """Test format_date with valid timestamp."""
    # Test with pandas Timestamp
    timestamp = pd.Timestamp("2024-04-11")
    result = format_date(timestamp)
    expected = (date(2024, 4, 11) - date(1900, 1, 1)).days
    assert result == expected

    # Test with datetime
    dt = datetime(2024, 4, 11)
    result = format_date(pd.Timestamp(dt))
    assert result == expected

def test_format_date_null():
    """Test format_date with null timestamp."""
    with pytest.raises(ValueError, match="Timestamp cannot be null when formatting date"):
        format_date(pd.NaT)

def test_extract_id_valid_spaced():
    """Test extract_id with hyperlink containing a space after the comma."""
    input_str = '=HYPERLINK("https://example.com/1", 123)'
    assert extract_id(input_str) == "123"


def test_extract_id_valid_unspaced():
    """Test extract_id with hyperlink that has no space after the comma."""
    input_str = '=HYPERLINK("https://example.com/2",123)'
    assert extract_id(input_str) == "123"


def test_extract_id_valid_other_format():
    """Test extract_id with a non-HYPERLINK format."""
    input_str = 'Something, 456)'
    assert extract_id(input_str) == "456"

def test_extract_id_invalid():
    """Test extract_id with invalid input."""
    # Test with integer
    assert extract_id(42) is None

    # Test with invalid string format
    assert extract_id("no numbers here") is None
    assert extract_id("123 not at end") is None
    assert extract_id("") is None

def test_create_filter_request():
    """Test create_filter_request."""
    worksheet_id = "test-id"
    result = create_filter_request(worksheet_id)
    
    assert "setBasicFilter" in result
    assert "filter" in result["setBasicFilter"]
    assert "range" in result["setBasicFilter"]["filter"]
    
    range_config = result["setBasicFilter"]["filter"]["range"]
    assert range_config["sheetId"] == worksheet_id
    assert range_config["startRowIndex"] == 0
    assert range_config["startColumnIndex"] == 0

def test_create_sort_request():
    """Test create_sort_request."""
    worksheet_id = "test-id"
    col_count = 5
    result = create_sort_request(worksheet_id, col_count)
    
    assert "sortRange" in result
    assert "range" in result["sortRange"]
    assert "sortSpecs" in result["sortRange"]
    
    range_config = result["sortRange"]["range"]
    assert range_config["sheetId"] == worksheet_id
    assert range_config["startRowIndex"] == 1
    assert range_config["startColumnIndex"] == 0
    assert range_config["endColumnIndex"] == col_count
    
    sort_specs = result["sortRange"]["sortSpecs"]
    assert len(sort_specs) == 1
    assert sort_specs[0]["dimensionIndex"] == 0
    assert sort_specs[0]["sortOrder"] == "DESCENDING" 
