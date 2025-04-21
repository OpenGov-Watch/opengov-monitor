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
    sink = SpreadsheetSink("test_credentials.json")
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

@pytest.fixture
def sample_df():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame({
        'url': ['=HYPERLINK("https://example.com/1", 1)'],
        'proposal_time': [pd.Timestamp('2024-04-11')],
        'DOT': [100.5],
        'latest_status_change': [pd.Timestamp('2024-04-10')]
    })

def test_spreadsheet_sink_initialization(mock_auth):
    """Test SpreadsheetSink initialization."""
    sink = SpreadsheetSink("test_credentials.json")
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
    assert isinstance(result_df['proposal_time'][0], (int, np.integer))
    assert isinstance(result_df['latest_status_change'][0], (int, np.integer))

def test_prepare_columns_for_json(spreadsheet_sink, sample_df):
    """Test column preparation for JSON."""
    # Create a sample DataFrame with all the columns that should be converted
    test_df = pd.DataFrame({
        'DOT': [100.5],
        'USD_proposal_time': [1000.0],
        'tally.ayes': [500.0],
        'tally.nays': [200.0],
        'tally.turnout': [0.75],
        'tally.total': [1000.0],
        'proposal_time': [pd.Timestamp('2024-04-11')],
        'latest_status_change': [pd.Timestamp('2024-04-10')],
        'USD_latest': [2000.0]
    })
    
    # Test preparation
    result_df = spreadsheet_sink._prepare_columns_for_json(test_df)

    # Verify results
    for col in ['DOT', 'USD_proposal_time', 'tally.ayes', 'tally.nays', 
                'tally.turnout', 'tally.total', 'USD_latest']:
        assert result_df[col].dtype == 'object'
        assert isinstance(result_df[col][0], str)

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

def test_apply_updates(spreadsheet_sink, mock_worksheet, sample_df, mocker):
    """Test the _apply_updates method with full row replacement behavior."""
    # Mock the logger
    mock_logger = mocker.Mock()
    spreadsheet_sink._logger = mock_logger
    
    # Setup test data
    sheet_data = {
        'A': [1, 2, 3],
        'B': ['x', 'y', 'z'],
        'C': [10, 20, 30]
    }
    sheet_df = pd.DataFrame(sheet_data, index=[1, 2, 3])
    
    # Update data that will replace entire rows
    update_data = {
        'A': [4, 5],
        'B': ['a', 'b']
        # Note: 'C' is missing to test that it gets set to NaN
    }
    update_df = pd.DataFrame(update_data, index=[1, 2])
    
    # Append data
    append_data = {
        'A': [6],
        'B': ['c'],
        'C': [60]
    }
    append_df = pd.DataFrame(append_data, index=[4])
    
    # Mock the worksheet and its methods
    mock_worksheet.update.return_value = None
    mock_worksheet.append_rows.return_value = None
    
    # Call the method
    spreadsheet_sink._apply_updates(
        mock_worksheet,
        sheet_df,
        update_df,
        append_df,
        "A2:D100"
    )
    
    # Verify the updates were applied correctly
    expected_sheet_data = {
        'A': [4, 5, 3],  # First two rows updated
        'B': ['a', 'b', 'z'],  # First two rows updated
        'C': ['', '', 30]  # C set to empty string for updated rows
    }
    expected_sheet_df = pd.DataFrame(expected_sheet_data, index=[1, 2, 3])
    
    # Verify worksheet was updated with correct data
    mock_worksheet.update.assert_called_once()
    update_call_args = mock_worksheet.update.call_args[0]
    actual_data = update_call_args[0]
    
    # Compare data with NaN handling
    assert len(actual_data) == len(expected_sheet_df)
    for actual_row, expected_row in zip(actual_data, expected_sheet_df.values.tolist()):
        assert len(actual_row) == len(expected_row)
        for actual_val, expected_val in zip(actual_row, expected_row):
            if expected_val == '':  # Changed from pd.isna to check for empty string
                assert actual_val == ''
            else:
                assert actual_val == expected_val
    
    assert update_call_args[1] == "A2:D100"  # Range
    assert mock_worksheet.update.call_args[1] == {'raw': False}  # Options as kwargs
    
    # Verify append was called with correct data
    mock_worksheet.append_rows.assert_called_once_with(
        [[6, 'c', 60]],  # Values are not converted to strings
        value_input_option='USER_ENTERED'
    )
    
    # Verify logging was called
    mock_logger.debug.assert_called()

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

def test_get_dataframe_stats(spreadsheet_sink):
    """Test DataFrame statistics collection."""
    # Test empty DataFrame
    empty_df = pd.DataFrame()
    empty_stats = spreadsheet_sink._get_dataframe_stats(empty_df, "empty")
    assert empty_stats["name"] == "empty"
    assert empty_stats["size"] == (0, 0)
    assert empty_stats["index_range"] == "empty"
    assert empty_stats["index_is_continuous"] is True
    assert empty_stats["gaps"] == []

def test_get_dataframe_stats_error(spreadsheet_sink):
    """Test get_dataframe_stats with invalid DataFrame."""
    with pytest.raises(AttributeError, match="Cannot get stats for None DataFrame"):
        spreadsheet_sink._get_dataframe_stats(None, "test")

def test_get_dataframe_stats_with_non_numeric_index(spreadsheet_sink):
    """Test _get_dataframe_stats with non-numeric index."""
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
    assert result["index_is_continuous"] is True  # Non-numeric indices are always considered continuous
    assert result["gaps"] == []

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
    df = pd.DataFrame(data, index=['a', 'b', 'c'])

    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    assert stats["index_is_continuous"] is True  # Non-numeric indices are always considered continuous
    assert stats["gaps"] == []

def test_get_dataframe_stats_with_mixed_index(spreadsheet_sink):
    """Test _get_dataframe_stats with mixed numeric and non-numeric index."""
    data = {'A': [1, 2, 3]}
    df = pd.DataFrame(data, index=['1', 'not_a_number', '3'])

    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    # When converting to numeric, '1' and '3' become numbers, 'not_a_number' becomes NaN
    # So _find_gaps will detect a gap between 1 and 3
    assert stats["index_is_continuous"] is True  # Non-numeric indices are treated as continuous
    assert stats["gaps"] == [(1.0, 3.0)]  # Gap is detected between numeric values

def test_get_dataframe_stats_with_type_error(spreadsheet_sink):
    """Test _get_dataframe_stats with index that raises TypeError."""
    data = {'A': [1, 2, 3]}
    df = pd.DataFrame(data, index=[1, None, 3])

    stats = spreadsheet_sink._get_dataframe_stats(df, "test")
    # When converting to numeric, 1 and 3 stay numbers, None becomes NaN
    # So _find_gaps will detect a gap between 1 and 3
    assert stats["index_is_continuous"] is True  # Invalid indices are treated as continuous
    assert stats["gaps"] == [(1.0, 3.0)]  # Gap is detected between numeric values

def test_find_gaps(spreadsheet_sink):
    """Test gap detection in index sequences."""
    test_cases = [
        # Empty index
        (pd.Index([]), []),
        # No gaps
        (pd.Index([1, 2, 3]), []),
        # Single gap
        (pd.Index([1, 3, 4]), [(1.0, 3.0)]),
        # Multiple gaps
        (pd.Index([1, 3, 5, 8]), [(1.0, 3.0), (3.0, 5.0), (5.0, 8.0)]),
        # Unsorted index
        (pd.Index([3, 1, 5]), [(1.0, 3.0), (3.0, 5.0)]),
    ]

    for index, expected in test_cases:
        # Convert index to numeric
        numeric_index = pd.to_numeric(index)
        result = spreadsheet_sink._find_gaps(numeric_index)
        assert result == expected

@pytest.fixture
def mock_debug():
    """Create a mock debug logger."""
    with patch('logging.Logger.debug') as mock:
        yield mock

def test_apply_updates_logging(mock_debug, spreadsheet_sink, mock_worksheet):
    """Test logging in apply_updates method."""
    # Create test DataFrames with numeric and string data
    sheet_df = pd.DataFrame({
        "url": ["=HYPERLINK(\"https://example.com/1\", \"1\")", "=HYPERLINK(\"https://example.com/2\", \"2\")"],
        "value": [1.0, 2.0],
        "text": ["a", "b"]
    })
    sheet_df = spreadsheet_sink._prepare_index_matching(sheet_df)  # This sets the index

    update_df = pd.DataFrame({
        "url": ["=HYPERLINK(\"https://example.com/1\", \"1\")"],
        "value": [3.0],
        "text": ["c"]
    })
    update_df = spreadsheet_sink._prepare_index_matching(update_df)

    append_df = pd.DataFrame({
        "url": ["=HYPERLINK(\"https://example.com/3\", \"3\")"],
        "value": [4.0],
        "text": ["d"]
    })
    append_df = spreadsheet_sink._prepare_index_matching(append_df)

    # Call the method
    spreadsheet_sink._apply_updates(
        mock_worksheet, sheet_df, update_df, append_df, "A2:C10"
    )

    # Verify logging calls
    assert mock_debug.call_count == 3  # Initial, post-update, and post-append logs

    # Verify initial log content structure
    first_call = mock_debug.call_args_list[0]
    assert first_call[0][0] == "Starting updates"
    first_call_extra = first_call[1]["extra"]
    
    # Check range string
    assert first_call_extra["range_string"] == "A2:C10"
    
    # Check dataframe stats structure
    stats = first_call_extra["dataframe_stats"]
    assert all(key in stats for key in ["sheet_df", "update_df", "append_df"])
    
    # Verify sheet_df stats
    sheet_stats = stats["sheet_df"]
    assert sheet_stats["name"] == "sheet_df"
    assert sheet_stats["size"] == (2, 3)  # 2 rows, 3 columns
    assert "index_range" in sheet_stats
    assert "index_is_continuous" in sheet_stats
    assert isinstance(sheet_stats["gaps"], list)
    
    # Verify update_df stats
    update_stats = stats["update_df"]
    assert update_stats["name"] == "update_df"
    assert update_stats["size"] == (1, 3)  # 1 row, 3 columns
    
    # Verify append_df stats
    append_stats = stats["append_df"]
    assert append_stats["name"] == "append_df"
    assert append_stats["size"] == (1, 3)  # 1 row, 3 columns

    # Verify post-update log
    second_call = mock_debug.call_args_list[1]
    assert second_call[0][0] == "Updated existing rows"
    assert "post_update_stats" in second_call[1]["extra"]
    update_stats = second_call[1]["extra"]["post_update_stats"]
    assert update_stats["name"] == "update_df"
    assert update_stats["size"] == (1, 3)

    # Verify post-append log
    third_call = mock_debug.call_args_list[2]
    assert third_call[0][0] == "Appended new rows"
    assert "post_append_stats" in third_call[1]["extra"]
    append_stats = third_call[1]["extra"]["post_append_stats"]
    assert append_stats["name"] == "append_df"
    assert append_stats["size"] == (1, 3)

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
        gaps = spreadsheet_sink._find_gaps(result_df.index)
        assert len(gaps) == 1
        assert gaps[0] == (1.0, 3.0)

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

def test_find_sequence_gaps_with_invalid_input(spreadsheet_sink):
    """Test _find_sequence_gaps with invalid input that raises an exception."""
    # Create a list with mixed types that will cause int() to fail
    sorted_ids = ['1', 'invalid', '3']
    
    # Call the method
    result = spreadsheet_sink._find_sequence_gaps(sorted_ids)
    
    # Verify that an empty list is returned for invalid input
    assert result == [] 

def test_numpy_type_conversion():
    """Test conversion of numpy types to native Python types."""
    test_data = [
        ['=HYPERLINK("https://test.com/1", 1)',
         'Test Title',
         'Deciding',
         np.float64(20.0),  # numpy float64
         np.int64(100),     # numpy int64
         '',                # empty string
         np.nan            # numpy NaN
        ]
    ]
    
    sink = SpreadsheetSink({
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": "test-key",
        "client_email": "test@test.com",
        "client_id": "test-client-id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40test.com"
    })
    
    converted_data = sink._convert_to_native_types(test_data)
    
    # Check type conversions
    assert isinstance(converted_data[0][3], float)
    assert isinstance(converted_data[0][4], int)
    assert converted_data[0][5] == ''
    assert converted_data[0][6] == ''  # NaN should be converted to empty string
    
    # Check values are preserved
    assert converted_data[0][3] == 20.0
    assert converted_data[0][4] == 100

def test_worksheet_update_with_numpy_types():
    """Test worksheet update with numpy data types."""
    mock_worksheet = MagicMock()
    mock_spreadsheet = MagicMock()
    mock_worksheet.spreadsheet = mock_spreadsheet

    test_df = pd.DataFrame({
        'value': [np.float64(20.0), np.int64(100)],
        'text': ['a', 'b']
    })

    sink = SpreadsheetSink({
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": "test-key",
        "client_email": "test@test.com",
        "client_id": "test-client-id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40test.com"
    })

    sink._apply_updates(
        mock_worksheet,
        test_df,
        pd.DataFrame(),
        pd.DataFrame(),
        'A1:B2'
    )

    # Check that update was called with converted types
    update_calls = mock_worksheet.update.call_args_list
    assert len(update_calls) == 1

    # Get the actual data passed to update
    actual_data = update_calls[0][0][0]

    # Verify types are native Python types
    assert isinstance(actual_data[0][0], (int, float))  # Numeric value
    assert isinstance(actual_data[0][1], str)  # Text value
    assert isinstance(actual_data[1][0], (int, float))  # Numeric value
    assert isinstance(actual_data[1][1], str)  # Text value

def test_worksheet_append_with_numpy_types():
    """Test worksheet append with numpy data types."""
    mock_worksheet = MagicMock()
    mock_spreadsheet = MagicMock()
    mock_worksheet.spreadsheet = mock_spreadsheet

    test_df = pd.DataFrame({
        'value': [np.float64(20.0), np.int64(100)],
        'text': ['a', 'b']
    })

    sink = SpreadsheetSink({
        "type": "service_account",
        "project_id": "test-project",
        "private_key_id": "test-key-id",
        "private_key": "test-key",
        "client_email": "test@test.com",
        "client_id": "test-client-id",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test%40test.com"
    })

    sink._apply_updates(
        mock_worksheet,
        pd.DataFrame(),
        pd.DataFrame(),
        test_df,
        'A1:B2'
    )

    # Check that append_rows was called with converted types
    append_calls = mock_worksheet.append_rows.call_args_list
    assert len(append_calls) == 1

    # Get the actual data passed to append_rows
    actual_data = append_calls[0][0][0]

    # Verify types are native Python types
    assert isinstance(actual_data[0][0], (int, float))  # Numeric value
    assert isinstance(actual_data[0][1], str)  # Text value
    assert isinstance(actual_data[1][0], (int, float))  # Numeric value
    assert isinstance(actual_data[1][1], str)  # Text value 