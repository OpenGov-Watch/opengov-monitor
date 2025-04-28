import pytest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import numpy as np
from datetime import datetime
from data_sinks.google.spreadsheet import SpreadsheetSink
from unittest import mock

@pytest.fixture
def mock_auth():
    """Create a mock auth object."""
    with patch('data_sinks.google.spreadsheet.GoogleAuth') as mock:
        auth = mock.return_value
        auth.client = Mock()
        auth.connect = Mock()
        yield auth

@pytest.fixture
def spreadsheet_sink(mock_auth):
    """Create a SpreadsheetSink instance with mocked auth."""
    sink = SpreadsheetSink({"type": "service_account"})
    sink.auth = mock_auth.return_value
    return sink

@pytest.fixture
def mock_worksheet():
    """Create a mock worksheet object."""
    worksheet = Mock()
    worksheet.id = "test-worksheet-id"
    worksheet.row_count = 100
    worksheet.col_count = 5
    worksheet.spreadsheet = Mock()
    worksheet.spreadsheet.batch_update = Mock()
    return worksheet

def test_spreadsheet_sink_initialization(mock_auth):
    """Test SpreadsheetSink initialization."""
    sink = SpreadsheetSink({"type": "service_account"})
    sink.auth = mock_auth.return_value
    assert sink.auth == mock_auth.return_value
    assert sink._logger.name == "data_sinks.google.spreadsheet"

def test_setup_worksheet(spreadsheet_sink, mock_worksheet, sample_df):
    """Test worksheet setup."""
    # Mock the spreadsheet and worksheet creation
    mock_spreadsheet = Mock()
    mock_spreadsheet.worksheet.return_value = mock_worksheet
    spreadsheet_sink.auth.client.open_by_key.return_value = mock_spreadsheet

    # Test the setup
    worksheet, range_string, col_count = spreadsheet_sink._setup_worksheet(
        "spreadsheet_id", "sheet1", sample_df
    )

    # Verify calls
    spreadsheet_sink.auth.client.open_by_key.assert_called_once_with("spreadsheet_id")
    mock_spreadsheet.worksheet.assert_called_once_with("sheet1")
    
    # Verify results
    assert worksheet == mock_worksheet
    assert range_string == "A2:D100"  # For a df with 4 columns
    assert col_count == 4

def test_setup_worksheet_too_many_columns(spreadsheet_sink, mock_worksheet):
    """Test worksheet setup with too many columns."""
    # Create a DataFrame with more than 26 columns
    df = pd.DataFrame(columns=[f"col_{i}" for i in range(27)])
    
    with pytest.raises(AssertionError, match="Too many columns for the current implementation"):
        spreadsheet_sink._setup_worksheet("spreadsheet_id", "sheet1", df)

def test_load_sheet_data(spreadsheet_sink, mock_worksheet, sample_df):
    """Test loading sheet data."""
    # Mock worksheet data
    mock_data = [
        ['=HYPERLINK("https://example.com/1", 1)', '2024-04-11', '100.5', '2024-04-10']
    ]
    mock_worksheet.get.return_value = mock_data

    # Test loading
    sheet_df = spreadsheet_sink._load_sheet_data(
        mock_worksheet, "A2:D100", sample_df.columns, False
    )

    # Verify calls
    mock_worksheet.get.assert_called_once_with("A2:D100", value_render_option="FORMULA")
    
    # Verify results
    assert isinstance(sheet_df, pd.DataFrame)
    assert list(sheet_df.columns) == list(sample_df.columns)
    assert len(sheet_df) == 1

def test_load_sheet_data_empty(spreadsheet_sink, mock_worksheet, sample_df):
    """Test loading empty sheet data."""
    # Mock empty worksheet data
    mock_worksheet.get.return_value = [[]]

    # Test loading with empty first row allowed
    sheet_df = spreadsheet_sink._load_sheet_data(
        mock_worksheet, "A2:D100", sample_df.columns, True
    )

    assert isinstance(sheet_df, pd.DataFrame)
    assert list(sheet_df.columns) == list(sample_df.columns)
    assert len(sheet_df) == 0

def test_prepare_index_matching(spreadsheet_sink, sample_df):
    """Test index matching preparation."""
    # Create a sheet DataFrame with URLs
    sheet_df = pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/1", 1)'],
        'proposal_time': [pd.Timestamp('2024-04-11')],
        'DOT': [100.5]
    })

    # Test preparation
    result_df = spreadsheet_sink._prepare_index_matching(sheet_df)

    # Verify results
    assert "id" in result_df.index.name
    assert result_df.index[0] == "1"

def test_transform_dates(spreadsheet_sink, sample_df):
    """Test date transformation."""
    # Test transformation
    result_df = spreadsheet_sink._transform_dates(sample_df)

    # Verify results
    assert isinstance(result_df['proposal_time'][0], (int, np.int64))
    assert isinstance(result_df['latest_status_change'][0], (int, np.int64))

def test_process_deltas(spreadsheet_sink, sample_df):
    """Test delta processing."""
    # Create a sheet DataFrame with some existing data
    sheet_df = pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/1", 1)'],
        'proposal_time': [pd.Timestamp('2024-04-11')],
        'DOT': [100.5],
        'latest_status_change': [pd.Timestamp('2024-04-10')]
    })
    sheet_df = spreadsheet_sink._prepare_index_matching(sheet_df)
    
    # Prepare sample_df with the same index
    sample_df = spreadsheet_sink._prepare_index_matching(sample_df)
    
    # Test processing
    update_df, append_df = spreadsheet_sink._process_deltas(sample_df, sheet_df)

    # Verify results
    assert len(update_df) == 1
    assert len(append_df) == 0
    assert update_df.index[0] == "1"


def test_apply_formatting(spreadsheet_sink, mock_worksheet):
    """Test applying formatting."""
    # Test applying formatting
    spreadsheet_sink._apply_formatting(mock_worksheet)

    # Verify calls
    mock_worksheet.spreadsheet.batch_update.assert_called_once()

def test_update_worksheet(spreadsheet_sink, mock_worksheet, sample_df):
    """Test the main update_worksheet method."""
    # Mock all the internal method calls
    with patch.object(spreadsheet_sink, '_setup_worksheet') as mock_setup, \
         patch.object(spreadsheet_sink, '_load_sheet_data') as mock_load, \
         patch.object(spreadsheet_sink, '_prepare_index_matching') as mock_prepare, \
         patch.object(spreadsheet_sink, '_transform_dates') as mock_transform, \
         patch.object(spreadsheet_sink, '_prepare_columns_for_json') as mock_json, \
         patch.object(spreadsheet_sink, '_process_deltas') as mock_deltas, \
         patch.object(spreadsheet_sink, '_apply_updates') as mock_updates, \
         patch.object(spreadsheet_sink, '_apply_formatting') as mock_formatting:

        # Setup mocks
        mock_setup.return_value = (mock_worksheet, "A2:D100", 4)
        mock_load.return_value = pd.DataFrame()
        mock_prepare.return_value = pd.DataFrame()
        mock_transform.return_value = sample_df
        mock_json.return_value = sample_df
        mock_deltas.return_value = (sample_df, pd.DataFrame())

        # Test the main method
        spreadsheet_sink.update_worksheet(
            "spreadsheet_id", "sheet1", sample_df, False
        )

        # Verify all methods were called
        mock_setup.assert_called_once()
        mock_load.assert_called_once()
        mock_prepare.assert_called_once()
        mock_transform.assert_called_once()
        mock_json.assert_called_once()
        mock_deltas.assert_called_once()
        mock_updates.assert_called_once()
        mock_formatting.assert_called_once()

def test_connect(spreadsheet_sink):
    """Test the connect method."""
    spreadsheet_sink.connect()
    spreadsheet_sink.auth.connect.assert_called_once()

def test_load_sheet_data_value_error(spreadsheet_sink, mock_worksheet, sample_df):
    """Test load_sheet_data with ValueError."""
    # Mock worksheet data with wrong number of columns
    mock_data = [['col1']]  # Only one column when we expect more
    mock_worksheet.get.return_value = mock_data

    # Test loading with ValueError
    with pytest.raises(ValueError):
        spreadsheet_sink._load_sheet_data(
            mock_worksheet, "A2:D100", sample_df.columns, False
        )

def test_load_sheet_data_empty_not_allowed(spreadsheet_sink, mock_worksheet, sample_df):
    """Test load_sheet_data with empty data not allowed."""
    # Mock empty worksheet data
    mock_worksheet.get.return_value = [[]]

    # Test loading with empty data not allowed
    with pytest.raises(SystemExit):
        spreadsheet_sink._load_sheet_data(
            mock_worksheet, "A2:D100", sample_df.columns, False
        )

def test_apply_updates_with_append(spreadsheet_sink, mock_worksheet, sample_df):
    """Test apply_updates with data to append."""
    # Create test data with matching columns
    sheet_df = pd.DataFrame({
        "url": ["=HYPERLINK(\"https://example.com/1\", 1)"],
        "proposal_time": [pd.Timestamp("2024-04-10")],
        "DOT": [100.0],
        "latest_status_change": [pd.Timestamp("2024-04-10")]
    }, index=["1"])
    
    update_df = pd.DataFrame()
    append_df = sample_df.copy()

    # Test applying updates with append
    spreadsheet_sink._apply_updates(
        mock_worksheet, sheet_df, update_df, append_df, "A2:D100"
    )
    
    # Verify calls
    mock_worksheet.update.assert_called_once()
    mock_worksheet.append_rows.assert_called_once()

def test_update_worksheet_invalid_format(spreadsheet_sink, mock_worksheet, sample_df):
    """Test update_worksheet with invalid format."""
    with patch.object(spreadsheet_sink, '_load_sheet_data', return_value=None):
        with pytest.raises(ValueError, match="The spreadsheet is not in the expected format"):
            spreadsheet_sink.update_worksheet("spreadsheet_id", "sheet1", sample_df, False)

def test_close(spreadsheet_sink):
    """Test the close method."""
    # Setup mock client with session
    mock_client = Mock()
    mock_client.session = Mock()
    spreadsheet_sink.auth.client = mock_client

    # Test close
    spreadsheet_sink.close()
    
    # Verify session was closed
    mock_client.session.close.assert_called_once()

def test_close_without_client(spreadsheet_sink):
    """Test the close method when no client exists."""
    spreadsheet_sink.auth.client = None
    spreadsheet_sink.close()  # Should not raise any error

def test_find_gaps(spreadsheet_sink):
    """Test gap detection in index sequences."""
    test_cases = [
        # Empty index
        (pd.Index([]), []),
        # No gaps
        (pd.Index([1, 2, 3]), []),
        # Single gap
        (pd.Index([1, 3, 4]), [(1, 3)]),
        # Multiple gaps
        (pd.Index([1, 3, 5, 8]), [(1, 3), (3, 5), (5, 8)]),
        # Unsorted index
        (pd.Index([3, 1, 5]), [(1, 3), (3, 5)]),
    ]
    
    for index, expected in test_cases:
        assert spreadsheet_sink._find_gaps(index) == expected

def test_get_dataframe_stats(spreadsheet_sink):
    """Test DataFrame statistics collection."""
    # Test empty DataFrame
    empty_df = pd.DataFrame()
    empty_stats = spreadsheet_sink._get_dataframe_stats(empty_df, "empty")
    assert empty_stats["size"] == (0, 0)
    assert empty_stats["index_range"] == "empty"
    assert empty_stats["index_is_continuous"] == True
    assert empty_stats["gaps"] == []
    
    # Test continuous DataFrame
    continuous_df = pd.DataFrame(
        {"col": range(5)}, 
        index=range(1, 6)
    )
    cont_stats = spreadsheet_sink._get_dataframe_stats(continuous_df, "continuous")
    assert cont_stats["size"] == (5, 1)
    assert cont_stats["index_range"] == "min=1 to max=5"
    assert cont_stats["index_is_continuous"] == True
    assert cont_stats["gaps"] == []
    
    # Test DataFrame with gaps
    gapped_df = pd.DataFrame(
        {"col": [1, 2, 3]}, 
        index=[1, 3, 5]
    )
    gap_stats = spreadsheet_sink._get_dataframe_stats(gapped_df, "gapped")
    assert gap_stats["size"] == (3, 1)
    assert gap_stats["index_range"] == "min=1 to max=5"
    assert gap_stats["index_is_continuous"] == False
    assert gap_stats["gaps"] == [(1, 3), (3, 5)]

@patch('logging.Logger.debug')
def test_apply_updates_logging(mock_debug, spreadsheet_sink, mock_worksheet):
    """Test logging in apply_updates method."""
    # Create test DataFrames with matching columns
    sheet_df = pd.DataFrame({
        "col": range(5),
        "num": range(5)
    }, index=range(1, 6))
    
    update_df = pd.DataFrame({
        "col": range(5, 8),
        "num": range(5, 8)
    }, index=range(6, 9))
    
    append_df = pd.DataFrame({
        "col": range(8, 10),
        "num": range(8, 10)
    }, index=range(9, 11))
    
    spreadsheet_sink._apply_updates(
        mock_worksheet, sheet_df, update_df, append_df, "A1:B10"
    )
    
    # Verify logging calls
    assert mock_debug.call_count == 3  # Initial, post-update, and post-append logs
    
    # Verify log content structure
    first_call_args = mock_debug.call_args_list[0][1]["extra"]["dataframe_stats"]
    assert "sheet_df" in first_call_args
    assert "update_df" in first_call_args
    assert "append_df" in first_call_args
    assert "range_string" in first_call_args
    
    # Verify post-update stats
    second_call_args = mock_debug.call_args_list[1][1]["extra"]["post_update_stats"]
    assert second_call_args["name"] == "post_update"
    assert second_call_args["size"] == (8, 2)  # Updated sheet_df size
    
    # Verify final stats after append
    third_call_args = mock_debug.call_args_list[2][1]["extra"]["final_stats"]
    assert third_call_args["name"] == "final"
    assert third_call_args["size"] == (10, 2)  # Combined size after append

def test_apply_updates_data_integrity(spreadsheet_sink, mock_worksheet):
    """Test data integrity during updates."""
    # Test numeric type conversion
    sheet_df = pd.DataFrame({
        "num": [1.0, 2.0, 3.0],
        "str": ["a", "b", "c"]
    }, index=[1, 2, 3])
    
    update_df = pd.DataFrame({
        "num": ["4.0", "5.0"],
        "str": ["d", "e"]
    }, index=[2, 3])
    
    append_df = pd.DataFrame({
        "num": [6.0],
        "str": ["f"]
    }, index=[4])
    
    spreadsheet_sink._apply_updates(
        mock_worksheet, sheet_df, update_df, append_df, "A1:B4"
    )
    
    # Verify numeric conversion
    assert pd.api.types.is_float_dtype(sheet_df["num"])
    
    # Verify final values
    assert sheet_df.loc[2, "num"] == 4.0
    assert sheet_df.loc[2, "str"] == "d"
    assert sheet_df.loc[3, "num"] == 5.0
    assert sheet_df.loc[3, "str"] == "e"

def test_load_sheet_data_system_exit(spreadsheet_sink, mock_worksheet, sample_df):
    """Test load_sheet_data with empty first row and allow_empty_first_row=False."""
    mock_worksheet.get.return_value = [[]]
    with pytest.raises(SystemExit):
        spreadsheet_sink._load_sheet_data(mock_worksheet, "A2:D100", sample_df.columns, False)

def test_prepare_index_matching_with_empty_ids(spreadsheet_sink):
    """Test prepare_index_matching with empty IDs."""
    sheet_df = pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/invalid", 123)', '=HYPERLINK("https://example.com/", 456)'],
        'proposal_time': [pd.Timestamp('2024-04-11'), pd.Timestamp('2024-04-11')],
        'DOT': [100.5, 200.5]
    })
    
    def mock_extract_id(url):
        if "invalid" in url:
            return None
        return None
    
    with patch('data_sinks.google.utils.extract_id', side_effect=mock_extract_id):
        result_df = spreadsheet_sink._prepare_index_matching(sheet_df)
        assert len(result_df) == 2
        assert all(pd.isna(result_df.index))

def test_prepare_index_matching_with_gaps(spreadsheet_sink):
    """Test prepare_index_matching with gaps in ID sequence."""
    sheet_df = pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/1", 1)', '=HYPERLINK("https://example.com/3", 3)'],
        'proposal_time': [pd.Timestamp('2024-04-11'), pd.Timestamp('2024-04-11')],
        'DOT': [100.5, 200.5]
    })
    
    def mock_extract_id(url):
        if "1" in url:
            return "1"
        if "3" in url:
            return "3"
        return None
    
    with patch('data_sinks.google.utils.extract_id', side_effect=mock_extract_id):
        result_df = spreadsheet_sink._prepare_index_matching(sheet_df)
        assert len(result_df) == 2
        assert result_df.index.tolist() == ['1', '3']
        
        # Verify that gaps are detected
        gaps = spreadsheet_sink._find_sequence_gaps([1, 3])
        assert len(gaps) == 1
        assert gaps[0]['start'] == 1
        assert gaps[0]['end'] == 3
        assert gaps[0]['gap_size'] == 1

def test_get_dataframe_stats_error(spreadsheet_sink):
    """Test get_dataframe_stats with invalid DataFrame."""
    with pytest.raises(AttributeError):  # None has no attribute 'shape'
        spreadsheet_sink._get_dataframe_stats(None, "test") 

def test_prepare_index_matching_with_url_extraction_error(spreadsheet_sink, mocker):
    """Test _prepare_index_matching with URL extraction error."""
    # Mock the logger
    mock_logger = mocker.Mock()
    spreadsheet_sink._logger = mock_logger
    
    # Create test data with invalid URL that will cause an extraction error
    data = {
        'url': ['=HYPERLINK("invalid_url", "text")'],
        'proposal_time': [pd.Timestamp("2024-04-10")],
        'DOT': [100.0],
        'latest_status_change': [pd.Timestamp("2024-04-10")]
    }
    df = pd.DataFrame(data)
    
    # Call the method
    result = spreadsheet_sink._prepare_index_matching(df)
    
    # Verify that the error was logged
    mock_logger.warning.assert_any_call(
        'Could not extract ID from URL: =HYPERLINK("invalid_url", "text")',
        extra={"error": "Could not extract numeric ID from URL"}
    )

def test_prepare_index_matching_with_sequence_gap_error(spreadsheet_sink, mocker):
    """Test _prepare_index_matching with sequence gap check error."""
    # Mock the logger
    mock_logger = mocker.Mock()
    spreadsheet_sink._logger = mock_logger
    
    # Create test data with URLs that will cause a sequence gap check error
    data = {
        'url': [
            '=HYPERLINK("https://example.com", 1)',
            '=HYPERLINK("https://example.com", 3)'  # Gap between 1 and 3
        ],
        'proposal_time': [pd.Timestamp("2024-04-10")] * 2,
        'DOT': [100.0] * 2,
        'latest_status_change': [pd.Timestamp("2024-04-10")] * 2
    }
    df = pd.DataFrame(data)
    
    # Call the method
    result = spreadsheet_sink._prepare_index_matching(df)
    
    # Verify that the gap was detected and logged
    mock_logger.warning.assert_any_call(
        "Found gaps in ID sequence",
        extra={
            "gaps": [{'start': 1, 'end': 3, 'gap_size': 1}],
            "operation": None
        }
    )

def test_get_dataframe_stats_with_non_numeric_index(spreadsheet_sink):
    """Test _get_dataframe_stats with non-numeric index."""
    # Create test data with non-numeric index
    data = {
        'A': [1, 2, 3],
        'B': ['x', 'y', 'z']
    }
    df = pd.DataFrame(data, index=['a', 'b', 'c'])
    
    # Call the method
    result = spreadsheet_sink._get_dataframe_stats(df, "test")
    
    # Verify the result
    assert result["name"] == "test"
    assert result["size"] == (3, 2)
    assert result["index_range"] == "min=a to max=c"
    assert result["index_is_continuous"] is True  # Non-numeric indices are always considered continuous
    assert result["gaps"] == []  # Non-numeric indices have no gaps 

def test_prepare_index_matching_with_extraction_error(spreadsheet_sink):
    """Test _prepare_index_matching with an extraction error."""
    # Create test data with a URL that will cause an extraction error
    data = {
        'url': ['=HYPERLINK("https://example.com/invalid/url", "invalid")'],
        'proposal_time': [pd.Timestamp("2024-04-10")],
        'DOT': [100.0],
        'latest_status_change': [pd.Timestamp("2024-04-10")]
    }
    df = pd.DataFrame(data)
    
    # Call the method
    result = spreadsheet_sink._prepare_index_matching(df)
    
    # Verify that the error was handled and NA was used
    assert pd.isna(result.index[0])

def test_get_dataframe_stats_with_none(spreadsheet_sink):
    """Test _get_dataframe_stats with None DataFrame."""
    with pytest.raises(AttributeError, match="Cannot get stats for None DataFrame"):
        spreadsheet_sink._get_dataframe_stats(None, "test")

def test_get_dataframe_stats_with_empty_df(spreadsheet_sink):
    """Test _get_dataframe_stats with empty DataFrame."""
    empty_df = pd.DataFrame()
    stats = spreadsheet_sink._get_dataframe_stats(empty_df, "empty")
    
    assert stats["name"] == "empty"
    assert stats["size"] == (0, 0)
    assert stats["index_range"] == "empty"
    assert stats["index_is_continuous"] is True
    assert stats["gaps"] == []

def test_get_dataframe_stats_with_non_numeric_index_error(spreadsheet_sink):
    """Test _get_dataframe_stats with non-numeric index that raises TypeError."""
    data = {'A': [1, 2, 3]}
    df = pd.DataFrame(data, index=['a', 'b', 'c'])  # String indices will cause TypeError in numeric comparison
    
    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    assert stats["index_is_continuous"] is True  # Non-numeric indices are considered continuous
    assert stats["gaps"] == []  # Non-numeric indices have no gaps

def test_prepare_index_matching_with_sequence_check_error(spreadsheet_sink, mocker):
    """Test _prepare_index_matching with sequence check error."""
    # Mock the logger
    mock_logger = mocker.Mock()
    spreadsheet_sink._logger = mock_logger
    
    # Create test data that will cause a sequence check error
    data = {
        'url': [
            '=HYPERLINK("https://example.com", "not_a_number")',  # This will cause isdigit() to return False
            '=HYPERLINK("https://example.com", "also_not_a_number")'
        ],
        'proposal_time': [pd.Timestamp("2024-04-10")] * 2,
        'DOT': [100.0] * 2,
        'latest_status_change': [pd.Timestamp("2024-04-10")] * 2
    }
    df = pd.DataFrame(data)
    
    # Call the method
    result = spreadsheet_sink._prepare_index_matching(df)
    
    # Verify that the extraction warnings were logged
    mock_logger.warning.assert_any_call(
        'Could not extract ID from URL: =HYPERLINK("https://example.com", "not_a_number")',
        extra={"error": "Could not extract numeric ID from URL"}
    )
    mock_logger.warning.assert_any_call(
        'Could not extract ID from URL: =HYPERLINK("https://example.com", "also_not_a_number")',
        extra={"error": "Could not extract numeric ID from URL"}
    )

def test_find_sequence_gaps_error(spreadsheet_sink):
    """Test _find_sequence_gaps with non-numeric values."""
    # Create a list with non-numeric values that will cause int() to fail
    sorted_ids = ['a', 'b', 'c']
    
    # Call the method
    result = spreadsheet_sink._find_sequence_gaps(sorted_ids)
    
    # Verify that an empty list is returned for non-numeric values
    assert result == []

def test_get_dataframe_stats_with_mixed_index(spreadsheet_sink):
    """Test _get_dataframe_stats with mixed numeric and non-numeric index."""
    data = {'A': [1, 2, 3]}
    df = pd.DataFrame(data, index=['1', 'not_a_number', '3'])
    
    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    assert stats["index_is_continuous"] is True  # Non-numeric indices are considered continuous
    assert stats["gaps"] == []  # Non-numeric indices have no gaps

def test_find_gaps_with_non_numeric_index(spreadsheet_sink):
    """Test _find_gaps with non-numeric index."""
    # Create an index with non-numeric values
    index = pd.Index(['a', 'b', 'c'])
    
    # Call the method
    result = spreadsheet_sink._find_gaps(index)
    
    # Verify that an empty list is returned for non-numeric indices
    assert result == [] 

def test_prepare_index_matching_with_sequence_check_error_exception(spreadsheet_sink, mocker):
    """Test _prepare_index_matching with sequence check error that raises an exception."""
    # Mock the logger
    mock_logger = mocker.Mock()
    spreadsheet_sink._logger = mock_logger
    
    # Create test data that will cause a sequence check error
    data = {
        'url': [
            '=HYPERLINK("https://example.com/1", "1")',
            '=HYPERLINK("https://example.com/invalid", "invalid")'  # This will cause int() to fail
        ],
        'proposal_time': [pd.Timestamp("2024-04-10")] * 2,
        'DOT': [100.0] * 2,
        'latest_status_change': [pd.Timestamp("2024-04-10")] * 2
    }
    df = pd.DataFrame(data)
    
    # Mock extract_id to return the values we want
    def mock_extract_id(url):
        if "/1" in url:
            return "1"
        return None  # Return None for invalid URLs
    
    with patch('data_sinks.google.utils.extract_id', side_effect=mock_extract_id):
        # Call the method
        result = spreadsheet_sink._prepare_index_matching(df)
        
        # Verify that the error was logged
        mock_logger.warning.assert_any_call(
            'Could not extract ID from URL: =HYPERLINK("https://example.com/invalid", "invalid")',
            extra={"error": "Could not extract numeric ID from URL"}
        )
        
        # Verify the result
        assert len(result) == 2
        assert result.index[0] == "1"
        assert pd.isna(result.index[1])  # The invalid ID should be NA

def test_find_sequence_gaps_with_invalid_input(spreadsheet_sink):
    """Test _find_sequence_gaps with invalid input that raises an exception."""
    # Create a list with mixed types that will cause int() to fail
    sorted_ids = ['1', 'invalid', '3']
    
    # Call the method
    result = spreadsheet_sink._find_sequence_gaps(sorted_ids)
    
    # Verify that an empty list is returned for invalid input
    assert result == [] 

def test_get_dataframe_stats_with_type_error(spreadsheet_sink):
    """Test _get_dataframe_stats with index that raises TypeError."""
    # Create a DataFrame with mixed types in the index
    data = {'A': [1, 2, 3]}
    df = pd.DataFrame(data, index=[1, None, 3])  # None will cause TypeError in comparison
    
    # Call the method
    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    
    # Verify that the stats are correct
    assert stats["index_is_continuous"] is True  # Non-numeric indices are considered continuous
    assert stats["gaps"] == []  # Non-numeric indices have no gaps

def test_find_gaps_with_type_error(spreadsheet_sink):
    """Test _find_gaps with index that raises TypeError."""
    # Create an index with mixed types that will cause TypeError
    index = pd.Index([1, None, 3])  # None will cause TypeError in comparison
    
    # Call the method
    result = spreadsheet_sink._find_gaps(index)
    
    # Verify that an empty list is returned for invalid input
    assert result == [] 