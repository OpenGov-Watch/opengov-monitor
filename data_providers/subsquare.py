from .data_provider import DataProvider
import requests
import pandas as pd
import logging

class SubsquareProvider(DataProvider):

    def __init__(self, network_info, price_service):
        self.network_info = network_info
        self.price_service = price_service
        self._logger = logging.getLogger(__name__)

    def fetch_referenda(self, num_referenda=10):
        df = self._fetch('referendums', num_referenda)
        df = self._transform_referenda(df)
        return df

    # Out: ['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'propose_time', 'last_status_change', 'USD_latest']
    def _transform_referenda(self, df):
        df = df.copy()

        # for our own sanity, we just let known proposals pass
        def _sanityCheck(row):
            acceptable_proposals = [
                "0x1300", # treasury.proposeSpend
                "0x1303", # treasury.spendLocal
                "0x2201", # bounties.approveBounty
                "0x1305", # treasury.spend
                "0x6300", # xcmPallet.send
            ]
            if (len(row["onchainData"]["proposal"]) > 0) and (row["onchainData"]["proposal"]["callIndex"] not in acceptable_proposals):
                self._logger.info(f"Unknown proposal type: {row['onchainData']['proposal']}")

        df.apply(_sanityCheck, axis=1)

        def _determineDOTAmount(row):
            known_zero_value_proposals = [
                "0x1503", # referenda.cancel
                "0x2201", # bounties.approveBounty
                "0x6300", # xcmPallet.send
            ]

            if "treasuryInfo" in row:
                return row["treasuryInfo"]["amount"]
            elif "treasuryBounties" in row: # accepting a new bounty
                return 0
            elif len(row["proposal"]) == 0: # no existing preimage
                return 0
            elif row["proposal"]["callIndex"] in known_zero_value_proposals:
                return 0
            else:
                self._logger.info(f"Unknown proposal type: {row['proposal']}")
                return 0

        def _determineOrigin(row):
            if "origins" in row["info"]["origin"]:
                return row["info"]["origin"]["origins"]
            elif "system" in row["info"]["origin"] and row["info"]["origin"]["system"]["root"] == None:
                return "Root"
            else:
                self._logger.info(f"Unknown origin type: {row['info']['origin']}")
                return "<unknown>"

        df.rename(columns={
            "createdAt": "proposal_time",
            "lastActivityAt": "latest_status_change",
            "referendumIndex": "id"    
        }, inplace=True)

        df["proposal_time"] = pd.to_datetime(df["proposal_time"])
        df["latest_status_change"] = pd.to_datetime(df["latest_status_change"])

        df["status"] = df["state"].apply(lambda x: x["name"])
        df[self.network_info.ticker] = pd.to_numeric(df["onchainData"].apply(lambda x:self.price_service.apply_denomination(_determineDOTAmount(x))))
        df["USD_proposal_time"] = df.apply(self._determine_usd_price_factory("proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._determine_usd_price_factory("latest_status_change"), axis=1)        
        df["tally.ayes"] = df.apply(lambda x: self.price_service.apply_denomination(x["onchainData"]["tally"]["ayes"]), axis=1)
        df["tally.nays"] = df.apply(lambda x: self.price_service.apply_denomination(x["onchainData"]["tally"]["nays"]), axis=1)
        df["track"] = df["onchainData"].apply(_determineOrigin)

        df.set_index("id", inplace=True)
        df = df[["title", "status", "DOT", "USD_proposal_time", "track", "tally.ayes", "tally.nays", "proposal_time", "latest_status_change", "USD_latest"]]

        return df


    def fetch_treasury_proposals(self, num_referenda=10):
        return self._fetch('treasury/proposals', num_referenda)

    def _fetch(self, proposal_type, num_referenda):
        base_url = f"https://{self.network_info.name}.subsquare.io/api/gov2/{proposal_type}?" #<-- referendums, treasury/proposals

        all_items = []
        page = 1

        while True:
            url = f"{base_url}&page={page}"
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                items = data['items']
                if not items:
                    break
                all_items.extend(items)
                page += 1

                self._logger.debug(f"Fetched {len(all_items)} items")

                if len(all_items) >= num_referenda:
                    break
            else:
                message = f"While fetching {proposal_type}, we received error: {response.status_code} {response.reason}"
                raise SystemExit(message)
                break

        df = pd.DataFrame(all_items)
        return df