# Monitoring Updater

This service collects Polkadot and Kusama governance information and writes it
into a Google Spreadsheet. It can run locally or as a scheduled job on Google
Cloud Run.

## Quick start

Create a virtual environment and install the dependencies:

```bash
python -m venv .venv
source .venv/bin/activate    # On Windows use .venv\Scripts\activate
pip install -r requirements.txt
```


## Summary
The app fetches referenda, treasury spends and other governance data from
Subsquare, enriches it with historical token prices and stores the result in a
spreadsheet. A Flask route exposes the update function so the job can be
triggered by Cloud Scheduler or executed locally.

## Project layout

```
opengov-monitor/
├── main.py          - Flask entrypoint that performs the update
├── config.yaml      - Limits and network block information
├── data_providers/  - Fetch data from Subsquare and price services
├── data_sinks/      - Write data to Google Sheets
├── utils/           - Helper utilities (logging etc.)
├── scripts/         - Helper scripts
├── tests/           - Unit tests
└── README.md
```

## How it works

1. `main.py` reads `config.yaml` and environment variables (`OPENGOV_MONITOR_SPREADSHEET_ID`, `OPENGOV_MONITOR_CREDENTIALS`).
2. `SubsquareProvider` fetches referenda, treasury spends and other data.
3. `PriceService` loads token prices so the value of proposals can be expressed in USD.
4. `SpreadsheetSink` connects to Google Sheets, compares existing rows with freshly fetched data and applies updates.


## Dump provider data

Use the helper script in `scripts/` to store the fetched data locally without updating a spreadsheet:

```bash
python scripts/dump_provider.py --network polkadot --out ./data_dump
```

This will produce CSV and JSON files for referenda, treasury spends and other data in the specified directory.



## Instructions

### Setting up the spreadsheet
1. Create a Google spreadsheet from template.xlsx in the main folder. Take a note of the spreadsheet ID in the url. You will need it later.
2. Create the service account that will be able to edit the sheet: https://developers.google.com/workspace/guides/create-credentials
    - If you haven't created a project before, you will need to create one.
    - Create a service account here: https://console.cloud.google.com/iam-admin/serviceaccounts
    - Then select it and under **Keys** create a new key. Download the JSON credentials file. You will need it later.

### Local Deployment
1. In `main.py` adjust the `network` variable (only `polkadot` or `kusama`) and optionally change `default_spreadsheet_id`.
2. Set environment variables:
    - `OPENGOV_MONITOR_SPREADSHEET_ID` – your spreadsheet ID (falls back to `default_spreadsheet_id`).
    - `OPENGOV_MONITOR_CREDENTIALS` – contents of the service account JSON. If not set, `credentials.json` will be read from the working directory.
3. Run the Flask app with `python main.py run` to execute a single update, or `flask run` to start the HTTP server.

### Cloud Configuration
1. Enable the following APIs:
    - Cloud Scheduler API
    - Cloud Run Admin API
    - Cloud Logging API
    - Cloud Build API
    - Artifact Registry API
    - Secret Manager API
    - Cloud Pub/Sub API
    - Identity and Access Management (IAM) API
    - IAM Service Account Credentials API
2. Open the IAM settings: https://console.cloud.google.com/iam-admin/iam and add the following roles to the service account:
    - Cloud Run Admin
    - Logs Writer
    - Secret Manager Secret Accessor
    - Artifact Registry Create-on-Push Repository Administrator
    - Cloud Build WorkerPool user
3. Configure a Cloud Build Trigger: https://console.cloud.google.com/cloud-build
4. Run the trigger for the first time. It should create a cloud service
5. Select the service in Cloud Run https://console.cloud.google.com/run and then "Edit and Deploy New Revision"
    - Copy the service URL. You will need it to set up the Cloud Scheduler job.
    - In Container(s), expand the container and look for the "Variables and Secrets" tab.
      - Add the environment variable `OPENGOV_MONITOR_SPREDSHEET_ID` and set it to the spreadsheet ID of the spreadsheet you created earlier.
      - Add the secret `OPENGOV_MONITOR_CREDENTIALS` and paste the content of the credentials file you downloaded earlier.
6. Create a scheduled job in Cloud Scheduler: https://console.cloud.google.com/cloudscheduler
    - Set the frequency to `0 0 * * *` to run the job every day at midnight.
    - Set the target to `HTTP` and paste the service URL you copied earlier.
    - Set the HTTP method to `GET`.
    - As Auth header, select `Add OIDC token`.
    - Select the service account you created earlier.

## Notes
- Data is fetched from Subsquare.
- USD prices of executed proposals are calculated to the exchange rate of the day of the last status change.
- Not every referendum gets a DOT value assigned from Subsquare. E.g. Bounties are not counted, since the money is not spent. We also see proposals without value where we don't have an explanation yet, e.g. 465

## Trouble Shooting
- Check the cloud logs here: https://console.cloud.google.com/logs/
- Make sure column A is formatted a whole number. If it isn't future updates won't work. Make it a whole number by setting `Format->Number->Automatic`.

## Logging Configuration
The application uses a comprehensive logging system that can be configured via `config.yaml`:

```yaml
logging:
  enable_file_logging: true  # Toggle file logging
  log_dir: "logs"           # Directory for log files
  max_file_size_mb: 10      # Maximum size of each log file in MB
  backup_count: 5           # Number of backup files to keep
```

Features:
- Logs to both console and file (file logging can be disabled)
- Captures detailed extra information in JSON format
- Rotates log files based on configured size and backup count
- Logs are stored in the configured `log_dir`
- All extra fields passed to loggers are automatically JSON-serialized and included in the output
- Log levels are set to DEBUG for application logs and INFO for third-party libraries

Example log format:
```
2024-04-11 14:30:00 - spreadsheet - DEBUG - Processing spreadsheet | Extra: {"gaps": [...], "urls": [...]} 
```

## Running tests

The tests use `pytest` and rely on mocks to avoid network access. After installing the
requirements, simply run:

```bash
pytest
```
