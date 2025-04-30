import re
import pandas as pd
import datetime

def format_date(timestamp):
    """Format a timestamp into days since 1900-01-01."""
    if pd.isnull(timestamp):
        raise ValueError("Timestamp cannot be null when formatting date")
    return (timestamp.date() - datetime.date(1899, 12, 30)).days


def extract_id(input_string):
    """Extract ID from a hyperlink string."""
    if isinstance(input_string, int):
        return None
    match = re.search(r',\s(\d+)\)$', input_string)
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

def create_sort_request(worksheet_id, worksheet_col_count):
    """Create a sort request configuration."""
    return {
        "sortRange": {
            "range": {
                "sheetId": worksheet_id,
                "startRowIndex": 1,
                "startColumnIndex": 0,
                "endColumnIndex": worksheet_col_count
            },
            "sortSpecs": [
                {
                    "dimensionIndex": 0,
                    "sortOrder": "DESCENDING"
                }
            ]
        }
    } 