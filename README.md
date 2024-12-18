# Monitoring Updater

## Summary
This app fetches Treasury proposals from Polkassembly and updates them on a Google Spreadsheet.

## Instructions

### Setting up the spreadsheet
1. Create a Google spreadsheet from template.xlsx in the main folder. Take a note of the spreadsheet ID in the url. You will need it later.
2. Create the service account that will be able to edit the sheet: https://developers.google.com/workspace/guides/create-credentials
    - If you haven't created a project before, you will need to create one.
    - Create a service account here: https://console.cloud.google.com/iam-admin/serviceaccounts
    - Then select it and under **Keys** create a new key. Download the JSON credentials file. You will need it later.

### Local Deployment
1. In the main.py main() function:
    - set the `network` (lower caps, only `polkadot` or `kusama`)
    - set the `default_spreadsheet_id` to the one you created in step 2
2. IF (AND ONLY IF) you want to run the script locally, store the credentials file in the main folder and rename it to `credentials.json`.

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