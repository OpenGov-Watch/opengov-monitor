from .data_provider import DataProvider
import requests
import pandas as pd
import logging
import json
from .network_info import NetworkInfo
from .asset_kind import AssetKind
from .assets_bag import AssetsBag
from datetime import datetime, timedelta
import os

class SubsquareProvider(DataProvider):

    def __init__(self, network_info: NetworkInfo, price_service):
        self.network_info: NetworkInfo = network_info
        self.price_service = price_service
        self._logger = logging.getLogger(__name__)

    def fetch_referenda(self, referenda_to_update=10):


        # fetch the updates
        # base_url = "https://polkadot.subsquare.io/_next/data/trrsQec9V4m7mgsk7Vg0w/referenda.json?"
        base_url = f"https://{self.network_info.name}-api.subsquare.io/gov2/referendums"

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

        logging.debug("Transforming referenda")
        df_updates = self._transform_referenda(df_updates)
        
        # Add continuity check
        self._log_continuity_check(df_updates, "referenda")
        
        return df_updates

    # Out: ['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'propose_time', 'last_status_change', 'USD_latest']
    def _transform_referenda(self, df):
        df = df.copy()

        # return the value of the proposal denominated in the network's token
        def _build_bag_from_call_value(bag, call, timestamp, ref_id):
            # we use this map to emit warnings of proposals we haven't seen on OpenGov before. Those that are known to be zero-value (because they are not Treasury-related) are excluded
            known_zero_value_call_indices = [
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
                "0x2201", # bounties.approveBounty <-- the amount to be given to the bounty is not part of the call data at proposal time
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

            try:

                if call_index in known_zero_value_call_indices:
                    return
                elif call_index in wrapped_proposals:
                    if call_index == "0x0102": # scheduler.scheduleNamed
                        inner_call = args[4]["value"]
                        _build_bag_from_call_value(bag, inner_call, timestamp, ref_id)
                    elif call_index == "0x0103": # scheduler.dispatchAs
                        inner_call = args[1]["value"]
                        _build_bag_from_call_value(bag, inner_call, timestamp, ref_id)
                    elif call_index == "0x0104": # scheduler.scheduleAfter
                        inner_call = args[3]["value"]
                        _build_bag_from_call_value(bag, inner_call, timestamp, ref_id)
                    elif call_index == "0x1a03": # utility.dispatchAs
                        
                        # let's make sure the caller is the treasury
                        try:
                            dispatch_source = args[0]["value"]["system"]["signed"]
                        except KeyError:
                            self._logger.warning(f"Ref {ref_id}: dispatchAs call does not have a signed source")
                            return
                        
                        if dispatch_source != self.network_info.treasury_address:
                            self._logger.warning(f"Ref {ref_id}: dispatchAs call does not have a treasury source")
                            return

                        """
                        income_neutral_dispatches = [
                            832, # Fellowship Subtreasury 2m - showing 0
                            1104, # Stablecoin conversion campaign - wrong value
                            457, # Stablecoin conversion campaign
                            231, # Fellowship Stablecoin Conversion Campaign
                        ]
                        if ref_id in income_neutral_dispatches:
                            return
                        """
                            
                        inner_call = args[1]["value"]
                        _build_bag_from_call_value(bag, inner_call, timestamp, ref_id)
                    else: # batch calls
                        for inner_call in args[0]["value"]:
                            # if you get an exception here, make sure you requested the details on this callIndex
                            _build_bag_from_call_value(bag, inner_call, timestamp, ref_id)
                elif call_index in should_inspect_proposal:
                    raise ValueError(f"Ref {ref_id}: {inner_call} not implemented")
                elif call_index == "0x0502": # balances.forceTransfer
                    assert args is not None, "we should always have the details of the call"
                    assert args[0]["name"] == "source"
                    source = args[0]["value"]["id"]
                    assert source == self.network_info.treasury_address
                    amount = args[2]["value"]
                    amount = self.network_info.apply_denomination(amount, self.network_info.native_asset)
                    bag.add_asset(self.network_info.native_asset, amount)
                elif call_index == "0x1305": # treasury.spend
                    assert args is not None, "we should always have the details of the call"
                    assert args[0]["name"] == "assetKind"
                    assetKind = self._get_XCM_asset_kind(args[0]["value"])
                    if assetKind == AssetKind.INVALID:
                        bag.set_nan()
                        return
                    
                    assert args[1]["name"] == "amount"
                    amount = args[1]["value"]

                    amount = self.network_info.apply_denomination(amount, assetKind)
                    bag.add_asset(assetKind, amount)    
                elif call_index == "0x0103": # scheduler.cancelNamed
                    if ref_id == 56: # cancel auction
                        return
                    raise ValueError(f"ref {ref_id}: {call} not implemented")
                elif call_index == "0x6308": # xcmPallet.limitedReserveTransferAssets"
                        assets = args[2]["value"]
                        value = self._get_XCM_asset_value(assets)
                        bag.add_asset(self.network_info.native_asset, value)
                elif call_index == "0x6309": # xcmPallet.limitedTeleportAssets
                        assets = args[2]["value"]
                        value = self._get_XCM_asset_value(assets)
                        bag.add_asset(self.network_info.native_asset, value)
                        return
                else:
                    self._logger.warning(f"ref {ref_id}: Unknown proposal type: {call}")
                    return
            except Exception as e:
                self._logger.warning(f"ref {ref_id}: Error processing call: {e}\n{call}")
                return

        def _bag_from_referendum_data(row) -> AssetsBag:
            bag = AssetsBag()

            # for some proposals, it would be too troublesome to write the deep packet inspection
            # so we just set the bag to NaN
            known_zero_value_proposals = {
                "polkadot": [
                    546, # Starlay Hack Recovery Attempt
                    1424, # Parallel Hack Recovery Attempt
                ]
            }

            try:
                if "treasuryInfo" in row["onchainData"]:
                    amount = row["onchainData"]["treasuryInfo"]["amount"]
                    amount = self.network_info.apply_denomination(amount, self.network_info.native_asset)
                    bag.add_asset(self.network_info.native_asset, amount)
                elif "treasuryBounties" in row: # accepting a new bounty
                    pass
                else:
                    ref_id = row["id"]
                    if ref_id in known_zero_value_proposals[self.network_info.name]:
                        bag.set_nan()
                        return bag

                    _build_bag_from_call_value(bag, row["onchainData"]["proposal"], row["proposal_time"], ref_id)
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

        df["bag"] = df.apply(_bag_from_referendum_data, axis=1)
        native_asset_name = self.network_info.native_asset.name
        df[f"{native_asset_name}_proposal_time"] = df.apply(self._get_value_converter(self.network_info.native_asset, "proposal_time"), axis=1)
        df[f"{native_asset_name}_latest"] = df.apply(self._get_value_converter(self.network_info.native_asset, "latest_status_change"), axis=1)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df[f"{native_asset_name}_component"] = df["bag"].apply(lambda x: x.get_amount(self.network_info.native_asset))
        df[f"USDC_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDC))
        df[f"USDT_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDT))
        df["tally.ayes"] = df.apply(lambda x: self.network_info.apply_denomination(x["onchainData"]["tally"]["ayes"], self.network_info.native_asset), axis=1)
        df["tally.nays"] = df.apply(lambda x: self.network_info.apply_denomination(x["onchainData"]["tally"]["nays"], self.network_info.native_asset), axis=1)
        df["track"] = df["onchainData"].apply(_determineTrack)
        df["url"] = df["id"].apply(lambda x:f'=HYPERLINK("{self.network_info.referenda_url}{x}", {x})')

        df.set_index("id", inplace=True)
        df = df[["url", "title", "status", f"{native_asset_name}_proposal_time", "USD_proposal_time", "track", "tally.ayes", "tally.nays", "proposal_time", "latest_status_change", f"{native_asset_name}_latest", "USD_latest", f"{native_asset_name}_component", "USDC_component", "USDT_component"]]

        return df

    def fetch_treasury_spends(self, items_to_update=10, block_number=None, block_datetime=None, block_time=None):
        #return self._fetchList('', num_referenda)
    
        base_url = f"https://{self.network_info.name}-api.subsquare.io/treasury/spends"
        df_updates = self._fetchList(base_url, items_to_update)

        # load details
        replacements = []
        detail_items = 0
        for index, row in df_updates.iterrows():
            url = f"{base_url}/{row['index']}.json"
            item = self._fetchItem(url)
            replacements.append(item)

            detail_items += 1
            if detail_items % 10 == 0:
                logging.debug(f"Fetched {detail_items} detail items")
        df_replacements = pd.DataFrame(replacements)
        df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
        df_updates.drop_duplicates(subset=["index"], keep="last", inplace=True)

        df_updates = self._transform_treasury_spends(df_updates, block_number, block_datetime, block_time)

        # Add continuity check
        # self._log_continuity_check(df_updates, "treasury proposals", "index")
        
        return df_updates

    def _transform_treasury_spends(self, df, reference_block_number: int =None, reference_block_datetime: datetime =None, block_time: float =None):
        df = df.copy()

        df.rename(columns={
            "index": "id",
            "state": "status",
            "title": "description",
        }, inplace=True)

        # https://polkadot.subsquare.io/api/treasury/spends/128.json

        def _bag_from_treasury_spend_data(row) -> AssetsBag:
            bag = AssetsBag()

            asset_kind = self._get_XCM_asset_kind(row["onchainData"]["meta"]["assetKind"])
            if asset_kind == AssetKind.INVALID:
                bag.set_nan()
                return bag

            amount = row["onchainData"]["meta"]["amount"]
            amount = self.network_info.apply_denomination(amount, asset_kind)
            bag.add_asset(asset_kind, amount)
            return bag

        def _estimate_block_datetime_from_block_number(block_number: int) -> datetime:
            assert block_number is not None, "block_number is None"
            assert reference_block_number is not None, "reference_block_number is None"
            assert reference_block_datetime is not None, "reference_block_datetime is None"
            assert block_time is not None, "block_time is None"
            # estimate the block time
            estimated_block_datetime = reference_block_datetime + timedelta(seconds=(block_number - reference_block_number) * block_time)
            return estimated_block_datetime

        df["proposal_time"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"]*1e6), utc=True)
        df["latest_status_change"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"]*1e6), utc=True)

        df["bag"] = df.apply(_bag_from_treasury_spend_data, axis=1)

        native_asset_name = self.network_info.native_asset.name
        df[f"{native_asset_name}_proposal_time"] = df.apply(self._get_value_converter(self.network_info.native_asset, "proposal_time"), axis=1)
        df[f"{native_asset_name}_latest"] = df.apply(self._get_value_converter(self.network_info.native_asset, "latest_status_change"), axis=1)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df[f"{native_asset_name}_component"] = df["bag"].apply(lambda x: x.get_amount(self.network_info.native_asset))
        df[f"USDC_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDC))
        df[f"USDT_component"] = df["bag"].apply(lambda x: x.get_amount(AssetKind.USDT))
        df["validFrom"] = df["onchainData"].apply(lambda x: _estimate_block_datetime_from_block_number(x["meta"]["validFrom"]))
        df["expireAt"] = df["onchainData"].apply(lambda x: _estimate_block_datetime_from_block_number(x["meta"]["expireAt"]))

        df["url"] = df["id"].apply(lambda x:f'=HYPERLINK("{self.network_info.treasury_spends_url}{x}", {x})')
        df.set_index("id", inplace=True)
        df = df[["url", "referendumIndex", "status", "description", 
                 f"{native_asset_name}_proposal_time", "USD_proposal_time", 
                 "proposal_time", "latest_status_change", 
                 f"{native_asset_name}_latest", "USD_latest", 
                 f"{native_asset_name}_component", "USDC_component", "USDT_component",
                 "validFrom", "expireAt"]]

        return df

    def fetch_child_bounties(self, child_bounties_to_update=10):
        base_url = f"https://{self.network_info.name}-api.subsquare.io/treasury/child-bounties" #&page_size=100
        df_updates = self._fetchList(base_url, child_bounties_to_update)

        df_updates = self._transform_child_bounties(df_updates)

        # we skip the continuity check for fellowship treasury spends
        # because I don't have the time to figure it out rn xoxo TE 2025-04-25
        
        return df_updates
    
    def fetch_fellowship_treasury_spends(self, items_to_update=10):
        base_url = f"https://collectives-api.subsquare.io/fellowship/treasury/spends"
        df_updates = self._fetchList(base_url, items_to_update)

        # load details
        replacements = []
        detail_items = 0
        for index, row in df_updates.iterrows():
            url = f"{base_url}/{row['index']}.json"
            item = self._fetchItem(url)
            replacements.append(item)

            detail_items += 1
            if detail_items % 10 == 0:
                logging.debug(f"Fetched {detail_items} detail items")
        df_replacements = pd.DataFrame(replacements)
        df_updates = pd.concat([df_updates, df_replacements], ignore_index=True)
        df_updates.drop_duplicates(subset=["index"], keep="last", inplace=True)

        df_updates = self._transform_fellowship_treasury_spends(df_updates)

        # Add continuity check
        # self._log_continuity_check(df_updates, "fellowship treasury spends", "index")
        
        return df_updates

    def _transform_fellowship_treasury_spends(self, df):
        df = df.copy()

        df.rename(columns={
            "index": "id",
            "state": "status",
            "title": "description",
        }, inplace=True)

        df[self.network_info.native_asset.name] = df["onchainData"].apply(lambda x:self.network_info.apply_denomination(x["meta"]["amount"], self.network_info.native_asset))
        df["bag"] = df.apply(lambda x: AssetsBag({self.network_info.native_asset: x[self.network_info.native_asset.name]}), axis=1)
        df["proposal_time"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"]*1e6), utc=True)
        df["latest_status_change"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"]*1e6), utc=True)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df["url"] = df["id"].apply(lambda x:f'=HYPERLINK("{self.network_info.fellowship_treasury_spend_url}{x}", {x})')
        df.set_index("id", inplace=True)
        df = df[["url", "status", "description", "DOT", "USD_proposal_time", "proposal_time", "latest_status_change", "USD_latest"]]

        return df

    def _check_continuous_ids(self, df, id_field=None):
        """
        Checks if the IDs are continuous and returns any gaps found.
        
        Args:
            df: DataFrame with IDs either as index or in a column
            id_field: Optional name of column containing IDs. If None, uses index
            
        Returns:
            tuple: (is_continuous: bool, gaps: list of missing IDs)
        """
        # Get all IDs as a sorted list
        if id_field is not None:
            ids = sorted(df[id_field].tolist())
        else:
            ids = sorted(df.index.tolist())
        
        if not ids:
            return True, []
        
        # Create a set of expected IDs from min to max
        expected_ids = set(range(min(ids), max(ids) + 1))
        
        # Find missing IDs
        actual_ids = set(ids)
        gaps = sorted(list(expected_ids - actual_ids))
        
        is_continuous = len(gaps) == 0
        
        return is_continuous, gaps

    def _log_continuity_check(self, df, data_type, id_field=None):
        """
        Helper method to perform and log continuity check results
        
        Args:
            df: DataFrame to check
            data_type: String describing the type of data (e.g., "referenda", "treasury proposals")
            id_field: Optional name of column containing IDs. If None, uses index
        """
        is_continuous, gaps = self._check_continuous_ids(df, id_field)
        if not is_continuous:
            self._logger.warning(f"Found gaps in {data_type} IDs: {gaps}")
            if len(gaps) <= 10:
                self._logger.warning(f"Missing IDs: {gaps}")
            else:
                self._logger.warning(f"First 10 missing IDs: {gaps[:10]}...")
                self._logger.warning(f"Total number of gaps: {len(gaps)}")

        # Log min and max IDs fetched
        ids = df[id_field] if id_field else df.index
        min_id = ids.min()
        max_id = ids.max()
        self._logger.info(f"Fetched {data_type} from ID {min_id} to {max_id}")

    def _transform_child_bounties(self, df):
        df = df.copy()

        df.rename(columns={
            "state": "status",
        }, inplace=True)

        # https://polkadot.subsquare.io/api/treasury/child-bounties
        # https://polkadot.subsquare.io/api/treasury/child-bounties/1234

        df[self.network_info.native_asset.name] = df["onchainData"].apply(lambda x:self.network_info.apply_denomination(x["value"], self.network_info.native_asset))
        df["bag"] = df.apply(lambda x: AssetsBag({self.network_info.native_asset: x[self.network_info.native_asset.name]}), axis=1)
        df["proposal_time"] =        pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][0]["indexer"]["blockTime"]*1e6), utc=True)
        df["latest_status_change"] = pd.to_datetime(df["onchainData"].apply(lambda x: x["timeline"][-1]["indexer"]["blockTime"]*1e6), utc=True)
        df["USD_proposal_time"] = df.apply(self._get_value_converter(AssetKind.USDC, "proposal_time"), axis=1)
        df["USD_latest"] = df.apply(self._get_value_converter(AssetKind.USDC, "latest_status_change"), axis=1)        
        df["description"] = df["onchainData"].apply(lambda x: x["description"])
        df["beneficiary"] = df["onchainData"].apply(lambda x: x["address"])    
        df["identifier"] = df.apply(lambda row: f'{row["parentBountyId"]}_{row["index"]}', axis=1)
        df["url"] = df["identifier"].apply(lambda x: f'=HYPERLINK("{self.network_info.child_bounty_url}{x}", "{x}")')

        df.set_index("identifier", inplace=True)
        df = df[["url", "index", "parentBountyId", "status", "description", "DOT", "USD_proposal_time", "beneficiary", "proposal_time", "latest_status_change", "USD_latest"]]

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
        
        # Save to CSV
        #csv_file_path = os.path.join("data", f"{base_url.split('/')[-1]}.csv")
        #os.makedirs(os.path.dirname(csv_file_path), exist_ok=True)
        #df.to_csv(csv_file_path, index=False)
        #self._logger.info(f"Saved data to {csv_file_path}")

        return df
    
    def _fetchItem(self, url):
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            message = f"While fetching {url}, we received error: {response.status_code} {response.reason}"
            raise SystemExit(message)

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
    
    
    def _get_XCM_asset_kind(self, asset_kind) -> AssetKind:
        """
        Determines the AssetKind from an XCM (Cross-Consensus Message) asset representation.

        This method parses different versions of XCM asset formats (v3, v4, v5)
        to identify the type of asset (e.g., DOT, KSM, USDC, USDT, DED).
        It handles native assets, stablecoins, and DED tokens based on their
        parachain ID and general index.

        Args:
            asset_kind (dict): A dictionary representing the XCM asset.

        Returns:
            AssetKind: The identified AssetKind, or AssetKind.INVALID if unknown or unsupported.
        """

        version_key = list(asset_kind.keys())[0]
        
        if version_key == "v3":
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
        elif version_key in ["v4", "v5"]:
            parachain = asset_kind[version_key]["location"]["interior"]["x1"][0]["parachain"]
            if parachain < 1000 or parachain >= 2000:
                self._logger.warning(f"Parachain {parachain} is not a system chain")
                return AssetKind.INVALID
            if asset_kind[version_key]["assetId"]["parents"] == 1 and asset_kind[version_key]["assetId"]["interior"]["here"] == None:
                return AssetKind.DOT
            interior = asset_kind[version_key]["assetId"]["interior"]
            assert interior["x2"][0]["palletInstance"] == 50
            general_index = interior["x2"][1]["generalIndex"]
            if general_index == 1337:
                return AssetKind.USDC
            elif general_index == 1984:
                return AssetKind.USDT
            else:
                self._logger.warning(f"Unknown asset kind: {asset_kind}")
                return AssetKind.INVALID
        else:
            self._logger.warning(f"Unknown asset kind version: {version_key} in {asset_kind}")
            return AssetKind.INVALID

    def _get_XCM_asset_value(self, assets) -> float:
        if "v3" in assets:
            raw_value = assets["v3"][0]["fun"]["fungible"]
        elif "v4" in assets:
            raw_value = assets["v4"][0]["fun"]["fungible"]
        else:
            raise ValueError(f"Unknown asset kind: {assets}")
        value = self.network_info.apply_denomination(raw_value, self.network_info.native_asset)
        return value