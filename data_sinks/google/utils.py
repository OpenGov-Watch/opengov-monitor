import re
import pandas as pd
import datetime

import datetime
import pandas as pd

def format_datetime(timestamp):
    """
    Format a timestamp into the Google Sheets serial number:
    days since 1899-12-30 plus fractional day for the time.
    Handles both offset-naive and offset-aware inputs.
    """
    if pd.isnull(timestamp):
        raise ValueError("Timestamp cannot be null when formatting date/datetime")
    
    # Epoch as naive datetime
    epoch = datetime.datetime(1899, 12, 30)

    # 1) Turn pandas.Timestamp into native datetime, or combine date with midnight
    if isinstance(timestamp, pd.Timestamp):
        dt = timestamp.to_pydatetime()
    elif isinstance(timestamp, datetime.date) and not isinstance(timestamp, datetime.datetime):
        dt = datetime.datetime.combine(timestamp, datetime.time())
    else:
        dt = timestamp  # assume already a datetime

    # 2) If it's timezone-aware, convert to UTC and drop tzinfo
    if dt.tzinfo is not None:
        # normalize to UTC
        dt = dt.astimezone(datetime.timezone.utc)
        # drop tzinfo to make it naive
        dt = dt.replace(tzinfo=None)

    # 3) Compute difference (this now works)
    delta = dt - epoch
    return delta.total_seconds() / 86400.0



def extract_id(input_string):
    """Extract ID from a hyperlink string."""
    if isinstance(input_string, int):
        return None
    match = re.search(r',\s*(\d+)\)$', input_string)
    return match.group(1) if match else None

def create_filter_request(worksheet_id):
    """Create a filter request configuration."""
    return {
        "setBasicFilter": {
            "filter": {
                "range": {
                    "sheetId": worksheet_id,
                    "startRowIndex": 0,
                    "startColumnIndex": 0,
                }
            }
        }
    }

def create_sort_request(worksheet_id, worksheet_col_count, sort_column_indexes):
    """Create a sort request configuration."""

    sort_specs = []
    for index in sort_column_indexes:
        sort_specs.append({
            "dimensionIndex": index,
            "sortOrder": "DESCENDING"
        })

    request = {
        "sortRange": {
            "range": {
                "sheetId": worksheet_id,
                "startRowIndex": 1,
                "startColumnIndex": 0,
                "endColumnIndex": worksheet_col_count
            },
            "sortSpecs": sort_specs
        }
    } 

    return request