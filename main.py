from data_providers.subsquare import SubsquareProvider
from data_providers.price_service import PriceService
from data_providers.network_info import NetworkInfo
from data_sinks import SpreadsheetSink
import json
import yaml
import os
from flask import Flask
from utils.custom_logging import setup_logging
from datetime import datetime


# Setup logging before creating the Flask app
logger, _ = setup_logging()

app = Flask(__name__)


@app.route("/")
def main():
    try:
        # Preconditions
        ## Parameters
        network = "polkadot"
        default_spreadsheet_id = "1yFm17tk87y2xqV9-VGCsz_s9IabCcgtz7ZbBIYrcBAs"
        explorer = "subsquare"

        # Load configuration from YAML file
        with open('config.yaml', 'r') as file:
            config = yaml.safe_load(file)
        
        referenda_to_fetch = config['fetch_limits']['referenda']
        treasury_spends_to_fetch = config['fetch_limits']['treasury_spends']
        child_bounties_to_fetch = config['fetch_limits']['child_bounties']
        fellowship_treasury_spends_to_fetch = config['fetch_limits']['fellowship_treasury_spends']

        block_number = config['block_time_projection']['block_number']
        block_datetime = config['block_time_projection']['block_datetime']
        block_time = config['block_time_projection']['block_time']


        env_var_names = list(os.environ.keys())
        logger.debug(f"Environment variable names: {env_var_names}")

        spreadsheet_id = os.environ.get('OPENGOV_MONITOR_SPREADSHEET_ID')
        if spreadsheet_id is None:
            logger.error("OPENGOV_MONITOR_SPREADSHEET_ID environment variable not set. Defaulting to test spreadsheet.")
            spreadsheet_id = default_spreadsheet_id
        assert spreadsheet_id is not None, "Please set the OPENGOV_MONITOR_SPREADSHEET_ID environment variable"

        credentials_string = os.environ.get('OPENGOV_MONITOR_CREDENTIALS')
        if credentials_string is None:
            logger.error("OPENGOV_MONITOR_CREDENTIALS environment variable not set. Trying to read from file.")
            credentials_string = open("credentials.json").read()
        assert credentials_string is not None, "Please configure the OPENGOV_MONITOR_CREDENTIALS environment variable or provide a credentials.json file"
        credentials_json = json.loads(credentials_string)
        
        network_info = NetworkInfo(network, explorer)
        price_service = PriceService(network_info)
        provider = SubsquareProvider(network_info, price_service)
        spreadsheet_sink = SpreadsheetSink(credentials_json)
        spreadsheet_sink.connect()

        # Fetch Data
        ## Prices  
        logger.info("Fetching prices")
        price_service.load_prices()

        # Fetch and sink referenda
        if referenda_to_fetch > 0:
            logger.info("Fetching referenda")   
            referenda_df = provider.fetch_referenda(referenda_to_fetch)
            logger.debug(f"Fetched {len(referenda_df)} referenda")

            logger.info("Updating Referenda worksheet")
            spreadsheet_sink.update_worksheet(spreadsheet_id, "Referenda", referenda_df, allow_empty_first_row=True)

        # Fetch and sink treasury proposals
        if treasury_spends_to_fetch > 0:
            logger.info("Fetching treasury proposals")
            treasury_df = provider.fetch_treasury_spends(treasury_spends_to_fetch, block_number, block_datetime, block_time)
            logger.debug(f"Fetched {len(treasury_df)} treasury proposals")

            logger.info("Updating Treasury worksheet")
            spreadsheet_sink.update_worksheet(spreadsheet_id, "Treasury", treasury_df, allow_empty_first_row=True)

        # Fetch and sink child bounties
        if child_bounties_to_fetch > 0:
            logger.info("Fetching child bounties")
            child_bounties_df = provider.fetch_child_bounties(child_bounties_to_fetch)
            logger.debug(f"Fetched {len(child_bounties_df)} child bounties")

            logger.info("Updating Child Bounties worksheet")
            spreadsheet_sink.update_worksheet(spreadsheet_id, "Child Bounties", child_bounties_df, allow_empty_first_row=True)

        # Fetch and sink fellowship treasury spends
        if fellowship_treasury_spends_to_fetch > 0:
            logger.info("Fetching fellowship treasury spends")
            fellowship_df = provider.fetch_fellowship_treasury_spends(fellowship_treasury_spends_to_fetch)
            logger.debug(f"Fetched {len(fellowship_df)} fellowship treasury spends")

            logger.info("Updating Fellowship worksheet")
            spreadsheet_sink.update_worksheet(spreadsheet_id, "Fellowship", fellowship_df, allow_empty_first_row=True)

        logger.info(f"Referenda data updated. View at: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit#gid=0")

        return "ok"

    except Exception as e:
        logger.error(f"An error occurred: {e}", exc_info=True)
        return f"error"

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "run":
        main()
    else:
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))