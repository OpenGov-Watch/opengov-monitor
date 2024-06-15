import pandas as pd

def format_date(date):
    if pd.isnull(date):
        return None
    return f"{date.year}-{date.month:02d}-{date.day:02d}"

