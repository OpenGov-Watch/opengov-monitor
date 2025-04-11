from .data_provider import DataProvider
import requests
import pandas as pd
import logging
import json
from .asset_kind import AssetKind
from .asssets_bag import AssetsBag

class SubsquareProvider(DataProvider):

    def __init__(self, network_info, price_service):
        self.network_info = network_info
        self.price_service = price_service
        self._logger = logging.getLogger(__name__)

    def fetch_referenda(self, referenda_to_update=10):


        # fetch the updates
        # base_url = "https://polkadot.subsquare.io/_next/data/trrsQec9V4m7mgsk7Vg0w/referenda.json?"
        base_url = f"https://{self.network_info.name}.subsquare.io/api/gov2/referendums"

        logging.debug("Fetching referenda list")
        df_updates = self._fetchList(base_url, referenda_to_update)

        # load details

        # for batch referenda, we need to fetch the individual referenda to inspect the proposal
        needs_detail_call_indices = [
            "0x1a00", # utility.batch
            "0x1a02", # utility.batchAll
            "0x1a03", # utility.dispatchAs
            "0x1a04", # utility.forceBatch
            "0x1305", # treasury.spend
            "0x6300", # xcmPallet.send
        ]

        logging.debug("Fetching referenda details")
        replacements = []
        detail_items = 0
        for index, row in df_updates.iterrows():
            # if we have a preimage and it is within the set of batch call indexes, we need to fetch the individual referenda
            if len(row["onchainData"]["proposal"]) > 0 and row["onchainData"]["proposal"]["callIndex"] in needs_detail_call_indices:
                url = f"{base_url}/{row['referendumIndex']}.json"
                referendum = self._fetchItem(url)
                replacements.append(referendum)

                detail_items += 1
                if detail_items % 10 == 0:
                    logging.debug(f"Fetched {detail_items} detail items")
        df_replacements = pd.DataFrame(replacements)
        df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
        df_updates.drop_duplicates(subset=["referendumIndex"], keep="last", inplace=True)

        logging.debug("Updating persisted ref data")
        df = self._fetch_and_update_persisted_data(df_updates, "data/referenda.csv", "referendumIndex", ["state", "onchainData"])

        logging.debug("Transforming referenda")
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
                    return self.network_info.native_asset
                
                assert concrete["interior"]["x2"][0]["palletInstance"] == 50
                general_index = concrete["interior"]["x2"][1]["generalIndex"]
                if general_index == 1337:
                    return AssetKind.USDC
                elif general_index == 1984:
                    return AssetKind.USDT
                elif general_index == 30:
                    return AssetKind.DED
                elif general_index == 19840000000000:
                    return AssetKind.INVALID # rolleyes emoji
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
        def _build_bag_from_call_value(bag, call, timestamp, ref_id):
            # we use this map to emit warnings of proposals we haven't seen on OpenGov before. Those that are known to be zero-value (because they are not Treasury-related) are excluded
            known_zero_value_proposals = [
                "0x0000", # system.remark
                "0x0007", # system.remarkWithEvent
                "0x0002", # system.setCode
                "0x0508", # balances.forceSetBalance <- 1042 burn the treasury
                "0x0509", # balances.forceAdjustTotalIssuance
                "0x0a00", # preimage.notePreimage <- lol 828
                "0x0a02", # preimage.requestPreimage <- eh 74
                "0x1300", # treasury.proposeSpend <- omg 1108
                "0x1302", # treasury.approveProposal <- wtf 351
                "0x1500", # referenda.submit
                "0x1503", # referenda.cancel
                "0x1504", # referenda.kill
                "0x1703", # whitelist.dispatchWhitelistedCallWithPreimage
                "0x1c00", # identity.addRegistrar
                "0x2200", # bounties.proposeBounty
                "0x2201", # bounties.approveBounty
                "0x2202", # bounties.proposeCurator
                "0x2203", # bounties.unassignCurator
                "0x2204", # bounties.acceptCurator
                "0x2207", # bounties.closeBounty
                "0x270b", # nominationPools.setConfigs
                "0x3303", # configuration.setMaxCodeSize
                "0x3800", # paras.forceSetCurrentCode
                "0x3c07", # hrmp.forceOpenHrmpChannel
                "0x3801", # paras.forceSetCurrentHead
                "0x4602", # registrar.deregister
                "0x4603", # registrar.swap
                "0x4604", # registrar.removeLock
                "0x4700", # slots.forceLease
                "0x4701", # slots.clearAllLeases
                "0x4800", # auctions.newAuction
                "0x6300", # xcmPallet.send
                "0x6500", # assetRate.create
                "0x6501", # assetRate.update
                "0x6502", # assetRate.remove
            ]

            wrapped_proposals = [
                "0x0102", # scheduler.scheduleNamed
                "0x0104", # scheduler.scheduleAfter
                "0x1a00", # utility.batch 
                "0x1a02", # utility.batchAll
                "0x1a03", # utility.dispatchAs
                "0x1a04", # utility.forceBatch
            ]

            should_inspect_proposal = [
                "0x6300", # xcmPallet.send
            ]

            # get call index
            call_index = None
            if len(call) == 0: # no preimage
                return
            
            if "call" in call:
                call = call["call"]

            call_index = call["callIndex"]
            args = call.get("args", None)


            if call_index in known_zero_value_proposals:
                return
            elif call_index in wrapped_proposals:
                if call_index == "0x0102": # scheduler.scheduleNamed
                    call = args[4]["value"]
                    _build_bag_from_call_value(bag, call, timestamp, ref_id)
                elif call_index == "0x0103": # scheduler.dispatchAs
                    call = args[1]["value"]
                    _build_bag_from_call_value(bag, call, timestamp, ref_id)
                elif call_index == "0x0104": # scheduler.scheduleAfter
                    call = args[3]["value"]
                    _build_bag_from_call_value(bag, call, timestamp, ref_id)
                elif call_index == "0x1a03": # utility.dispatchAs
                    call = args[1]["value"]
                    _build_bag_from_call_value(bag, call, timestamp, ref_id)
                else: # batch calls
                    for call in args[0]["value"]:
                        # if you get an exception here, make sure you requested the details on this callIndex
                        _build_bag_from_call_value(bag, call, timestamp, ref_id)
            elif call_index in should_inspect_proposal:
                raise ValueError(f"Ref {ref_id}: {call} not implemented")
            elif call_index == "0x0502": # balances.forceTransfer
                assert args is not None, "we should always have the details of the call"
                assert args[0]["name"] == "source"
                source = args[0]["value"]["id"]
                assert source == "13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB"
                amount = args[2]["value"]
                amount = self.network_info.apply_denomination(amount, self.network_info.native_asset)
                bag.add_asset(self.network_info.native_asset, amount)
            elif call_index == "0x1305": # treasury.spend
                assert args is not None, "we should always have the details of the call"
                assert args[0]["name"] == "assetKind"
                assetKind = _get_XCM_asset_kind(args[0]["value"])
                if assetKind == AssetKind.INVALID:
                    return
                
                assert args[1]["name"] == "amount"
                amount = args[1]["value"]

                amount = self.network_info.apply_denomination(amount, assetKind)
                bag.add_asset(assetKind, amount)    
            elif call_index == "0x1a03": # utility.dispatchAs
                income_neutral_dispatches = [
                    832, # Fellowship Subtreasury 2m
                    1104, # Stablecoin conversion campaign
                    546, # Starlay drama
                    457, # Stablecoin conversion campaign
                    231, # Fellowship Stablecoin Conversion Campaign
                ]

                if ref_id in income_neutral_dispatches:
                    return
                # in other cases we have to look at the call
                raise ValueError(f"ref {ref_id}: {call} not implemented")
            elif call_index == "0x0103": # scheduler.cancelNamed
                if ref_id == 56: # cancel auction
                    return
                raise ValueError(f"ref {ref_id}: {call} not implemented")
            else:
                self._logger.info(f"ref {ref_id}: Unknown proposal type: {call}")
                return

        def _bag_from_data(row) -> AssetsBag:
            bag = AssetsBag()

            try:

                if "treasuryInfo" in row["onchainData"]:
                    amount = row["onchainData"]["treasuryInfo"]["amount"]
                    amount = self.network_info.apply_denomination(amount, self.network_info.native_asset)
                    bag.add_asset(self.network_info.native_asset, amount)
                elif "treasuryBounties" in row: # accepting a new bounty
                    pass
                else:
                    _build_bag_from_call_value(bag, row["onchainData"]["proposal"], row["proposal_time"], row["id"])
            except Exception as e:
                if row['id'] != 1424:
                    self._logger.error(f"Error processing row {row['id']}: {e}")
                bag.set_nan()

            return bag
        
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

        df["proposal_time"] = pd.to_datetime(df["proposal_time"], utc=True)
        df["latest_status_change"] = pd.to_datetime(df["state"].apply(lambda x: x["indexer"]["blockTime"]*1e6), utc=True)

        df["status"] = df["state"].apply(_get_status)

        df["bag"] = df.apply(_bag_from_data, axis=1)
        native_asset_name = self.network_info.native_asset.name
        df[f"{native_asset_name}_proposal_time"] = df.apply(self._get_value_converter(self.network_info.native_asset, "proposal_time"), axis=1)
        df[f"{native_asset_name}_latest"] = df.apply(self._get_value_converter(self.network_info.native_asset, "latest_status_change"), axis=1)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df[f"{native_asset_name}_component"] = df["bag"].apply(lambda x: x.get_amount(self.network_info.native_asset))
        df[f"USDC_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDC))
        df[f"USDT_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDT))
        df["tally.ayes"] = df.apply(lambda x: self.network_info.apply_denomination(x["onchainData"]["tally"]["ayes"]), axis=1)
        df["tally.nays"] = df.apply(lambda x: self.network_info.apply_denomination(x["onchainData"]["tally"]["nays"]), axis=1)
        df["track"] = df["onchainData"].apply(_determineTrack)

        df.set_index("id", inplace=True)
        df = df[["title", "status", f"{native_asset_name}_proposal_time", "USD_proposal_time", "track", "tally.ayes", "tally.nays", "proposal_time", "latest_status_change", f"{native_asset_name}_latest", "USD_latest", f"{native_asset_name}_component", "USDC_component", "USDT_component"]]

        return df

    def fetch_treasury_proposals(self, proposals_to_update=10):
        #return self._fetchList('', num_referenda)
    
        base_url = f"https://{self.network_info.name}.subsquare.io/api/treasury/proposals"
        df_updates = self._fetchList(base_url, proposals_to_update)

    def fetch_child_bounties(self, child_bounties_to_update=10):
        base_url = f"https://{self.network_info.name}.subsquare.io/api/treasury/child-bounties" #&page_size=100
        df_updates = self._fetchList(base_url, child_bounties_to_update)
        df = self._fetch_and_update_persisted_data(df_updates, "data/child_bounties.csv", "index", ["state", "indexer"])

        df = self._transform_child_bounties(df)

        return df
    
    def _transform_child_bounties(self, df):
        df = df.copy()

        df.rename(columns={
            "index": "id",
            "state": "status",
        }, inplace=True)

        # https://polkadot.subsquare.io/api/treasury/child-bounties
        # https://polkadot.subsquare.io/api/treasury/child-bounties/1234

        df[self.network_info.native_asset.name] = df["onchainData"].apply(lambda x:self.network_info.apply_denomination(x["value"]))
        df["bag"] = df.apply(lambda x: AssetsBag({self.network_info.native_asset: x[self.network_info.native_asset.name]}), axis=1)
        df["proposal_time"] =        pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"]*1e6), utc=True)
        df["latest_status_change"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"]*1e6), utc=True)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df["description"] = df["onchainData"].apply(lambda x: x["description"])
        df["beneficiary"] = df["onchainData"].apply(lambda x: x["address"])    
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

        # we skip this code for now, since it is not yet adapted for the cloud
        return df_updates

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


    def _get_value_converter(self, target_asset: AssetKind, date_key, status_key=None):
        """
        Factory method to create a function that determines the USD price of a row.
        If a status_key is provided, it will be used to determine if the current price instead of the historic price.
        - If the status is an end status, the historic price of the date will be used.
        - If the status is not an end status, the current price will be used.
        If no status_key is provided, the historic price of the date will be used.

        Parameters:
        date_column (str): The name of the column that contains the date.
        status_column (str): The name of the column that contains the status. Default is None.

        Returns:
        function: A function that determines the USD price of a row.
        """

        # assumes that the ticker is present as key in the row
        # assumes that row["bag"] is already calculated
        def convert_value(row):
            try:
                historic_value_statuses = ["Executed", "TimedOut", "Approved", "Cancelled", "Rejected"]
                date = None
                if (status_key is None) or row[status_key] in historic_value_statuses:
                    # use the historic price
                    date = row[date_key]
                bag: AssetsBag = row["bag"]
                value = bag.get_total_value(self.price_service, target_asset, date)
                return value
            except Exception as e:
                self._logger.error(f"Error converting value for row {row}: {e}")
                return float('nan')

        return convert_value