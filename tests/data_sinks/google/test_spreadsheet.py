import pytest
from unittest.mock import Mock, patch, MagicMock
import pandas as pd
import numpy as np
from datetime import datetime
from data_sinks.google.spreadsheet import SpreadsheetSink

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

def test_apply_updates(spreadsheet_sink, mock_worksheet, sample_df):
    """Test applying updates."""
    # Create test data
    sheet_df = pd.DataFrame(index=["1"])
    update_df = sample_df
    append_df = pd.DataFrame()

    # Test applying updates
    spreadsheet_sink._apply_updates(
        mock_worksheet, sheet_df, update_df, append_df, "A2:D100"
    )

    # Verify calls
    mock_worksheet.update.assert_called_once()
    mock_worksheet.append_rows.assert_not_called()

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
    sheet_df = pd.DataFrame(index=["1"])
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