from .data_provider import DataProvider
import requests
import pandas as pd
import datetime
from utils import format_date

class PolkassemblyProvider(DataProvider):
    # Define your ID to Origin mapping
    _id_to_origin_mapping = {
        0: 'Root',
        1: 'Whitelisted Caller',
        10: 'Staking Admin',
        11: 'Treasurer',
        12: 'Lease Admin',
        13: 'Fellowship Admin',
        14: 'General Admin',
        15: 'Auction Admin',
        20: 'Referendum Canceller',
        21: 'Referendum Killer',
        30: 'Small Tipper',
        31: 'Big Tipper',
        32: 'Small Spender',
        33: 'Medium Spender',
        34: 'Big Spender'
    }


    def __init__(self, network_info, price_service):
        self.network_info = network_info
        self.price_service = price_service

    def fetch_referenda(self, page_size=10):
        df = self._fetch('referendums_v2', page_size)
        df = self._transform_referenda(df)
        return df
        
    """## Transform Referenda

    We will transform the referenda data to match the columns of the Google Spreadsheet. We will also add the USD values for the requestedAmount and the latest price of the token at the time of the last status change.

    The input columns are:
    ['id', 'status', 'status_history', 'track_no', 'requestedAmount', 'tally.ayes', 'tally.nays']

    The output columns are:
    ['url', 'title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'created', 'last_status_change', 'USD_latest']

    The indes is called 'id' and contains the post_id.

    """
    def _transform_referenda(self, df):

        df = df.copy() # avoid weeping and gnashing of teeth
        df["requestedAmount"].fillna(0, inplace=True) # replace empty amounts with 0
        df.rename(columns={"post_id": "id"}, inplace=True)

        # Build columns
        df["created"] = pd.to_datetime(df["status_history"].apply(lambda x: x[0]["timestamp"] if len(x) > 0 else None)).dt.tz_convert(None)
        df["last_status_change"] = pd.to_datetime(df["status_history"].apply(lambda x: x[-1]["timestamp"] if len(x) > 0 else None)).dt.tz_convert(None)
        df[self.network_info.ticker] = pd.to_numeric(df["requestedAmount"].apply(self.price_service.apply_denomination))
        df["USD_proposal_time"] = df.apply(self._determine_usd_price_factory("created",self.network_info.ticker), axis=1)
        df["USD_latest"] = df.apply(self._determine_usd_price_factory("last_status_change", "status"), axis=1)
        df["Status"] = df["status"]
        df["tally.ayes"] = pd.to_numeric(df["tally.ayes"]) / self.network_info.denomination_factor
        df["tally.nays"] = pd.to_numeric(df["tally.nays"]) / self.network_info.denomination_factor

        # Replace the 'Track' column with the mapping from IDs to Origin names
        df["Track"] = df["track_no"].map(PolkassemblyProvider._id_to_origin_mapping)

        # stringify to allow Google Spreadsheet write
        df["created"] = df["created"].apply(format_date)
        df["last_status_change"] = df["last_status_change"].apply(format_date)

        # More filtering
        df = df.set_index("id")
        df = df[["title", "Status", "DOT", "USD_proposal_time", "Track", "tally.ayes", "tally.nays", "created", "last_status_change", "USD_latest"]]
        return df

    def _determine_usd_price_factory(self, date_column, status_column=None):
        def determine_usd_price(row):
            statuses_where_i_want_to_get_the_historic_price = ["Executed"]
            if (status_column is not None) and row[status_column] in statuses_where_i_want_to_get_the_historic_price:
                executed_date = row[date_column]
                conversion_rate = self.price_service.get_historic_price(executed_date)
                return row[self.price_service.ticker] * conversion_rate
            else:
                if self.price_service.current_price is None:
                    raise ValueError("Current price not available. Call get_current_price() first.")
                return row[self.network_info.ticker] * self.price_service.current_price

        return determine_usd_price

    def _map_propose_time(self, timeline):
        if timeline[0]["type"] == "TreasuryProposal":
            return pd.NA
        if timeline[0]["type"] != "ReferendumV2":
            raise ValueError(f"The first item's type is {timeline[0]['type']}: {timeline}")
        if timeline[1]["type"] != "TreasuryProposal":
            raise ValueError(f"The second item's type is {timeline[0]['type']}: {timeline}")
        datetime_string = timeline[0]["statuses"][0]["timestamp"]
        return datetime.datetime.strptime(datetime_string, '%Y-%m-%dT%H:%M:%S.%fZ')


    """## Transform Treasury Proposals"""
    def transform_treasury_proposals(self, treasury_df, referendums_df, digits, denomination_factor, ticker, treasury_url, referenda_url):

        treasury_transformed = treasury_df.merge(referendums_df, left_on="ref_num", right_on="post_id", how='left', suffixes=('_treasury', '_referendum'))

        treasury_transformed.rename(columns={"treasury_num": "id"}, inplace=True)

        # Build columns
        treasury_transformed["propose_time"] = treasury_transformed["timeline_treasury"].apply(self._map_propose_time).apply(format_date)
        treasury_transformed["last_status_change"] = pd.to_datetime(treasury_transformed["status_history_treasury"].apply(lambda x: x[-1]["timestamp"] if len(x) > 0 else None)) # better timeline
        treasury_transformed["last_update"] = treasury_transformed["last_status_change"].apply(format_date)
        treasury_transformed["DOT"] = (pd.to_numeric(treasury_transformed["requestedAmount"]) / denomination_factor)
        treasury_transformed["USD_propose_time"] = treasury_transformed.apply(self._determine_usd_price_factory("propose_time"), axis=1)
        treasury_transformed["USD_last_update"] = treasury_transformed.apply(self._determine_usd_price_factory("last_update"), axis=1)
        treasury_transformed["Status"] = treasury_transformed["status_treasury"]
        treasury_transformed["ref_url"] = treasury_transformed["ref_num"].apply(lambda x:f'=HYPERLINK("{referenda_url}{x}", {x})')
        treasury_transformed["url"] = treasury_transformed["id"].apply(lambda x:f'=HYPERLINK("{treasury_url}{x}", {x})')

        # Replace the 'Track' column with the mapping from IDs to Origin names
        treasury_transformed["Track"] = treasury_transformed["track_no_referendum"].map(PolkassemblyProvider.id_to_origin_mapping)

        # Finalize df
        treasury_transformed = treasury_transformed.set_index("id")
        treasury_transformed = treasury_transformed[["url", "ref_url", "title_treasury", "propose_time", "last_update", "Status", "DOT", "USD_propose_time", "USD_last_update", "Track"]]
        treasury_transformed



    def fetch_treasury_proposals(self, page_size=10):
        def map_type(timeline, treasury_num):
            if timeline[0]["type"] == "TreasuryProposal":
                return pd.Series([-1,treasury_num])
            if timeline[0]["type"] != "ReferendumV2":
                raise ValueError(f"The first item's type is {timeline[0]['type']}: {timeline}")
            if timeline[1]["type"] != "TreasuryProposal":
                raise ValueError(f"The second item's type is {timeline[0]['type']}: {timeline}")

            return pd.Series([timeline[0]["index"], timeline[1]["index"]])

        treasury_df = self._fetch('treasury_proposals', page_size)

        treasury_df[["ref_num", "treasury_num"]] = treasury_df.apply(lambda row: map_type(row["timeline"], row["post_id"]), axis=1)

        
    def _fetch(self, proposal_type, page_size=10, track_status="All"):
        # Docs: https://documenter.getpostman.com/view/764953/2s93JxqLoH#0fa6d3c3-b9ee-428c-8f1c-85374edfd7de
        url = f"https://api.polkassembly.io/api/v1/listing/on-chain-posts?proposalType={proposal_type}&listingLimit={page_size}&trackStatus={track_status}&sortBy=newest"
        headers = {"x-network":self.network_info.name}

        print(url)

        # Send a GET request to the URL
        response = requests.get(url, headers=headers)

            # Check if the request was successful
        if response.status_code != 200:
            message = f"While fetching {proposal_type}, we received error: {response.status_code} {response.reason}"
            raise SystemExit(message)

        data = response.json()
        raw = pd.DataFrame(data)
        df = pd.json_normalize(raw['posts'])
        return df
    

