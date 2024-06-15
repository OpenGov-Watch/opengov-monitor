from .data_provider import DataProvider
import requests
import pandas as pd

class SubsquareProvider(DataProvider):

    def fetch_referenda(self, num_referenda=10):
        return self._fetch('referendums', num_referenda)

    def fetch_treasury_proposals(self, num_referenda=10):
        return self._fetch('treasury/proposals', num_referenda)

    def _fetch(self, proposal_type, num_referenda):
        base_url = f"https://{self.network}.subsquare.io/api/gov2/{proposal_type}?" #<-- referendums, treasury/proposals

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

                if len(all_items) >= num_referenda:
                    break
            else:
                message = f"While fetching {proposal_type}, we received error: {response.status_code} {response.reason}"
                raise SystemExit(message)
                break

        df = pd.DataFrame(all_items)
        return df