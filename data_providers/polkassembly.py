from .data_provider import DataProvider
import requests
import pandas as pd
import datetime

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

    # Output columns: ['url', 'title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'created', 'last_status_change', 'USD_latest']
    def fetch_referenda(self, num_referenda=10):
        df = self._fetch('referendums_v2', num_referenda)
        df = self._transform_referenda(df)
        return df
        
    """## Transform Referenda

    We will transform the referenda data to match the columns of the Google Spreadsheet. We will also add the USD values for the requestedAmount and the latest price of the token at the time of the last status change.

    The input columns are:
    ['id', 'status', 'status_history', 'track_no', 'requestedAmount', 'tally.ayes', 'tally.nays']

    The output columns are:
    (id)['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'created', 'last_status_change', 'USD_latest']

    The indes is called 'id' and contains the post_id.

    """
    def _transform_referenda(self, df):

        df = df.copy() # avoid weeping and gnashing of teeth
        df.fillna({"requestedAmount": 0}, inplace=True) # replace empty amounts with 0
        df.rename(columns={"post_id": "id"}, inplace=True)

        # Build columns
        df["created"] = pd.to_datetime(df["status_history"].apply(lambda x: x[0]["timestamp"] if len(x) > 0 else None)).dt.tz_convert(None)
        df["last_status_change"] = pd.to_datetime(df["status_history"].apply(lambda x: x[-1]["timestamp"] if len(x) > 0 else None)).dt.tz_convert(None)
        df[self.network_info.native_asset.name] = pd.to_numeric(df["requestedAmount"].apply(self.network_info.apply_denomination))
        df["USD_proposal_time"] = df.apply(self._determine_usd_price_factory("created"), axis=1)
        df["USD_latest"] = df.apply(self._determine_usd_price_factory("last_status_change", "status"), axis=1)
        df["Status"] = df["status"]
        df["tally.ayes"] = pd.to_numeric(df["tally.ayes"]) / self.network_info.denomination_factor
        df["tally.nays"] = pd.to_numeric(df["tally.nays"]) / self.network_info.denomination_factor

        # Replace the 'Track' column with the mapping from IDs to Origin names
        df["Track"] = df["track_no"].map(PolkassemblyProvider._id_to_origin_mapping)


        # More filtering
        df = df.set_index("id")
        df = df[["title", "Status", "DOT", "USD_proposal_time", "Track", "tally.ayes", "tally.nays", "created", "last_status_change", "USD_latest"]]
        return df

    def _map_propose_time(self, timeline):
        if timeline[0]["type"] == "TreasuryProposal":
            return pd.NA
        if timeline[0]["type"] != "ReferendumV2":
            raise ValueError(f"The first item's type is {timeline[0]['type']}: {timeline}")
        if timeline[1]["type"] != "TreasuryProposal":
            raise ValueError(f"The second item's type is {timeline[0]['type']}: {timeline}")
        datetime_string = timeline[0]["statuses"][0]["timestamp"]
        return datetime.datetime.strptime(datetime_string, '%Y-%m-%dT%H:%M:%S.%fZ')


    """Transform Treasury Proposals

    Transforming Referenda currently is based on the assumption that the 
    referenda data is already fetched. 

    This function will merge the treasury data with the referenda data and
    transform it to match the columns of the Google Spreadsheet. We will also
    add the USD values for the requestedAmount and the latest price of the
    token at the time of the last status change.    
    Assumptions:
    - referendums_df has all the referenda data that need to be merged with the treasury data
    """
    def _transform_treasury_proposals(self, treasury_df, referendums_df):

        df = treasury_df.merge(referendums_df, left_on="ref_num", right_on="post_id", how='left', suffixes=('_treasury', '_referendum'))

        df.rename(columns={"treasury_num": "id"}, inplace=True)

        # Build columns
        df["propose_time"] = df["timeline_treasury"].apply(self._map_propose_time)
        df["last_update"] = pd.to_datetime(df["status_history_treasury"].apply(lambda x: x[-1]["timestamp"] if len(x) > 0 else None)) # better timeline
        df["DOT"] = (pd.to_numeric(df["requestedAmount"]) / self.network_info.denomination_factor)
        df["USD_propose_time"] = df.apply(self._determine_usd_price_factory("propose_time"), axis=1)
        df["USD_last_update"] = df.apply(self._determine_usd_price_factory("last_update"), axis=1)
        df["Status"] = df["status_treasury"]

        # Replace the 'Track' column with the mapping from IDs to Origin names
        df["Track"] = df["track_no_referendum"].map(PolkassemblyProvider._id_to_origin_mapping)

        # Finalize df
        df = df.set_index("id")
        df = df[["ref_num", "title_treasury", "propose_time", "last_update", "Status", "DOT", "USD_propose_time", "USD_last_update", "Track"]]
        return df

    # Output columns: ['url', 'ref_url', 'title', 'propose_time', 'last_update', 'Status', 'DOT', 'USD_propose_time', 'USD_last_update', 'Track']
    def fetch_treasury_proposals(self, page_size=10):
        def map_type(timeline, treasury_num):
            if timeline[0]["type"] == "TreasuryProposal":
                return pd.Series([-1,treasury_num])
            if timeline[0]["type"] != "ReferendumV2":
                raise ValueError(f"The first item's type is {timeline[0]['type']}: {timeline}")
            if timeline[1]["type"] != "TreasuryProposal":
                raise ValueError(f"The second item's type is {timeline[0]['type']}: {timeline}")

            return pd.Series([timeline[0]["index"], timeline[1]["index"]])

        df = self._fetch('treasury_proposals', page_size)
        df[["ref_num", "treasury_num"]] = df.apply(lambda row: map_type(row["timeline"], row["post_id"]), axis=1)

        referenda_df = pd.DataFrame(columns=["post_id", "timeline", "status_history", "status", "requestedAmount", "track_no"])
        df = self._transform_treasury_proposals(df, referenda_df)
        return df
        
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
    

