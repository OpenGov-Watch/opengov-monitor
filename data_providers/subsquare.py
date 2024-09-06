from .data_provider import DataProvider
import requests
import pandas as pd
import logging
import json
from .price_service import AssetKind

class SubsquareProvider(DataProvider):

    def __init__(self, network_info, price_service):
        self.network_info = network_info
        self.price_service = price_service
        self._logger = logging.getLogger(__name__)

    def fetch_referenda(self, referenda_to_update=10):

        # fetch the updates
        # base_url = "https://polkadot.subsquare.io/_next/data/trrsQec9V4m7mgsk7Vg0w/referenda.json?"
        base_url = f"https://{self.network_info.name}.subsquare.io/api/gov2/referendums"

        df_updates = self._fetchList(base_url, referenda_to_update)

        # load details

        # for batch referenda, we need to fetch the individual referenda to inspect the proposal
        needs_detail_call_indices = [
            "0x1a00", # utility.batch
            "0x1a02", # utility.batchAll
            "0x1a04", # utility.forceBatch
            "0x1305", # treasury.spend
            "0x6300", # xcmPallet.send
        ]
        replacements = []
        for index, row in df_updates.iterrows():
            # if we have a preimage and it is within the set of batch call indexes, we need to fetch the individual referenda
            if len(row["onchainData"]["proposal"]) > 0 and row["onchainData"]["proposal"]["callIndex"] in needs_detail_call_indices:
                url = f"{base_url}/{row['referendumIndex']}.json"
                referendum = self._fetchItem(url)
                replacements.append(referendum)
        df_replacements = pd.DataFrame(replacements)
        df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
        df_updates.drop_duplicates(subset=["referendumIndex"], keep="last", inplace=True)

        df = self._fetch_and_update_persisted_data(df_updates, "data/referenda.csv", "referendumIndex", ["state", "onchainData"])


        df = self._transform_referenda(df)
        return df

    # Out: ['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'propose_time', 'last_status_change', 'USD_latest']
    def _transform_referenda(self, df):
        df = df.copy()

        def _get_XCM_asset_kind(asset_kind) -> AssetKind:
            if "v3" in asset_kind:
                parachain = asset_kind["v3"]["location"]["interior"]["x1"]["parachain"]
                if parachain >= 3000:
                    return AssetKind.INVALID
                assert parachain >= 1000 and parachain < 2000, "parachain is not a system chain"
                concrete = asset_kind["v3"]["assetId"]["concrete"]
                if  "here" in concrete["interior"]:
                    return AssetKind[self.network_info.ticker]
                
                assert concrete["interior"]["x2"][0]["palletInstance"] == 50
                general_index = concrete["interior"]["x2"][1]["generalIndex"]
                if general_index == 1337:
                    return AssetKind.USDC
                elif general_index == 1984:
                    return AssetKind.USDT
                elif general_index == 30:
                    return AssetKind.DED
                else:
                    self._logger.warn(f"Unknown asset kind: {asset_kind}")
                    return AssetKind.INVALID
            elif "v4" in asset_kind:
                parachain = asset_kind["v4"]["location"]["interior"]["x1"][0]["parachain"]
                assert parachain >= 1000 and parachain < 2000
                if asset_kind["v4"]["assetId"]["parents"] == 1 and asset_kind["v4"]["assetId"]["interior"]["here"] == None:
                    return AssetKind.DOT
                interior = asset_kind["v4"]["assetId"]["interior"]
                assert interior["x2"][0]["palletInstance"] == 50
                general_index = interior["x2"][1]["generalIndex"]
                if general_index == 1337:
                    return AssetKind.USDC
                elif general_index == 1984:
                    return AssetKind.USDT
                else:
                    raise ValueError(f"Unknown asset kind: {asset_kind}")
            else:
                raise ValueError(f"Unknown asset kind: {asset_kind}")
                
        def _get_latest_status_change(state) -> pd.Timestamp:
            return pd.to_datetime(state["indexer"]["blockTime"]*1e6)
        # return the value of the proposal denominated in the network's token
        def _get_proposal_value(proposal, timestamp) -> float:
            known_zero_value_proposals = [
                "0x0000", # system.remark
                "0x0002", # system.setCode
                "0x1503", # referenda.cancel
                "0x1504", # referenda.kill
                "0x1703", # whitelist.dispatchWhitelistedCallWithPreimage
                "0x2200", # bounties.proposeBounty
                "0x2201", # bounties.approveBounty
                "0x2202", # bounties.proposeCurator
                "0x2204", # bounties.acceptCurator
                "0x4603", # registrar.swap
                "0x6300", # xcmPallet.send
            ]

            batch_proposals = [
                "0x1a00", # utility.batch 
                "0x1a02", # utility.batchAll
                "0x1a04", # utility.forceBatch
            ]

            should_inspect_proposal = [
                
            ]

            # get call index
            call_index = None
            if len(proposal) > 0:
                if "call" in proposal:
                    call_index = proposal["call"]["callIndex"]
                    args = proposal["call"]["args"]
                else:
                    call_index = proposal["callIndex"]
                    if "args" in proposal:
                        args = proposal["args"]
                    else:
                        args = None
            else: # no preimage
                return 0

            if call_index in known_zero_value_proposals:
                return 0
            elif call_index in batch_proposals:
                value = 0
                for call in args[0]["value"]:
                    # if you get an exception here, make sure you requested the details on this callIndex
                    value += _get_proposal_value(call, timestamp)
                return value
            elif call_index in should_inspect_proposal:
                raise ValueError(f"{proposal} not implemented")
            elif call_index == "0x1305": # treasury.spend
                assert args is not None, "we should always have the details of the call"
                assert args[0]["name"] == "assetKind"
                assetKind = _get_XCM_asset_kind(args[0]["value"])
                if assetKind == AssetKind.INVALID:
                    return 0
                
                assert args[1]["name"] == "amount"
                amount = args[1]["value"]
    
                if assetKind.name != self.network_info.ticker:
                    return self.price_service.get_historic_network_token_value(assetKind, amount, timestamp)

                return self.price_service.apply_denomination(amount)
            else:
                self._logger.info(f"Unknown proposal type: {proposal}")
                return 0

        # returns the network-token-denominated value of the proposal
        def _determineDOTAmount(row) -> float:
            if "treasuryInfo" in row["onchainData"]:
                value = row["onchainData"]["treasuryInfo"]["amount"]
                return self.price_service.apply_denomination(value)
            elif "treasuryBounties" in row: # accepting a new bounty
                return 0
            else:
                return _get_proposal_value(row["onchainData"]["proposal"], row["proposal_time"])

        def _determineTrack(row):
            if "origins" in row["info"]["origin"]:
                return row["info"]["origin"]["origins"]
            elif "system" in row["info"]["origin"] and row["info"]["origin"]["system"]["root"] == None:
                return "Root"
            else:
                self._logger.info(f"Unknown origin type: {row['info']['origin']}")
                return "<unknown>"

        # fetches the status
        # if the status is Executed, we check the result
        # if the result is err, we return Executed_err
        # this helps to filter out failed referenda
        def _get_status(state) -> str:
            status = state["name"]
            if status == "Executed":
                result = list(state["args"]["result"].keys())[0]
                if result == "err":
                    return f"{status}_{result}"
            return status

        df.rename(columns={
            "createdAt": "proposal_time",
            "lastActivityAt": "latest_status_change",
            "referendumIndex": "id"    
        }, inplace=True)

        df["proposal_time"] = pd.to_datetime(df["proposal_time"]).dt.tz_localize(None)
        df["latest_status_change"] = pd.to_datetime(df["state"].apply(lambda x: x["indexer"]["blockTime"]*1e6)).dt.tz_localize(None)

        df["status"] = df["state"].apply(_get_status)
        df[self.network_info.ticker] = pd.to_numeric(df.apply(lambda x:_determineDOTAmount(x), axis=1))
        df["USD_proposal_time"] = df.apply(self._determine_usd_price_factory("proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._determine_usd_price_factory("latest_status_change"), axis=1)        
        df["tally.ayes"] = df.apply(lambda x: self.price_service.apply_denomination(x["onchainData"]["tally"]["ayes"]), axis=1)
        df["tally.nays"] = df.apply(lambda x: self.price_service.apply_denomination(x["onchainData"]["tally"]["nays"]), axis=1)
        df["track"] = df["onchainData"].apply(_determineTrack)

        df.set_index("id", inplace=True)
        df = df[["title", "status", "DOT", "USD_proposal_time", "track", "tally.ayes", "tally.nays", "proposal_time", "latest_status_change", "USD_latest"]]

        return df

    def fetch_treasury_proposals(self, proposals_to_update=10):
        #return self._fetchList('', num_referenda)
    
        base_url = f"https://{self.network_info.name}.subsquare.io/api/treasury/proposals"
        df_updates = self._fetchList(base_url, proposals_to_update)
        pi = 3

    def fetch_child_bounties(self, child_bounties_to_update=10):
        base_url = f"https://{self.network_info.name}-api.dotreasury.com/child-bounties" #&page_size=100
        df_updates = self._fetchList(base_url, child_bounties_to_update)
        df = self._fetch_and_update_persisted_data(df_updates, "data/child_bounties.csv", "index", ["state", "indexer"])

        df = self._transform_child_bounties(df)

        return df
    
    def _transform_child_bounties(self, df):
        df = df.copy()

        df.rename(columns={
            "index": "id",
        }, inplace=True)

        df["status"] = df["state"].apply(lambda x: x["state"])
        df["DOT"] = df["value"] / self.network_info.denomination_factor
        # drop the columns ["blockHash"]
        #df.drop(columns=["blockHash"], inplace=True)
        df["proposal_time"] = pd.to_datetime(df["indexer"].apply(lambda x: x["blockTime"])*1e6)
        df["latest_status_change"] = pd.to_datetime(df["state"].apply(lambda x: x["indexer"]["blockTime"])*1e6)
        df["USD_proposal_time"] = df.apply(self._determine_usd_price_factory("proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._determine_usd_price_factory("latest_status_change"), axis=1)        


        df.set_index("id", inplace=True)
        df = df[["parentBountyId", "status", "description", "DOT", "USD_proposal_time", "beneficiary", "proposal_time", "latest_status_change", "USD_latest"]]

        return df

    def _fetchList(self, base_url, num_items):

        all_items = []
        page = 1

        while True:
            url = f"{base_url}?page={page}&page_size=100"
            self._logger.debug(f"Fetching from {url}")
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                items = data['items']
                if not items:
                    break
                all_items.extend(items)
                page += 1

                self._logger.debug(f"Fetched {len(all_items)} items")

                if len(all_items) >= num_items:
                    break
            else:
                message = f"While fetching {base_url}, we received error: {response.status_code} {response.reason}"
                raise SystemExit(message)
                break

        df = pd.DataFrame(all_items)
        return df
    
    def _fetchItem(self, url):
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            message = f"While fetching {url}, we received error: {response.status_code} {response.reason}"
            raise SystemExit(message)
    
    def _fetch_and_update_persisted_data(self, df_updates, filename, index_col, jsonize_columns=[]):

        converter_map = {}
        for col in jsonize_columns:
            converter_map[col] = json.loads

        try:
            df_persisted = pd.read_csv(
                filename,
                # columns with serialized json will be converted to objects
                converters=converter_map
            )
        except FileNotFoundError:
            df_persisted = pd.DataFrame()
        # merge the new referenda with the old ones. Use referendumIndex as the key and overwrite the old data
        df = pd.concat([df_persisted, df_updates], ignore_index=True)
        df.drop_duplicates(subset=[index_col], keep="last", inplace=True)
        # store the df into a file, converting the onchainData to json
        df_persisted = df.copy()
        for col in jsonize_columns:
            df_persisted[col] = df_persisted[col].apply(json.dumps)
        # drop index
        df_persisted.to_csv(filename, index=False)

        return df


