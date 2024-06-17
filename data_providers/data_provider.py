from abc import ABC, abstractmethod

class DataProvider(ABC):

    @abstractmethod
    def fetch_referenda(self, num_referenda=10):
        """
        Fetch a list of referenda from the data provider.

        Parameters:
        num_referenda (int): The number of proposals to fetch. Default is 10.

        Returns:
        list: A list of referenda.
        ['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally.ayes', 'tally.nays', 'created', 'last_status_change', 'USD_latest']
        """
        pass

    @abstractmethod
    def fetch_treasury_proposals(self, num_proposals=10):
        """
        Fetch a list of treasury proposals from the data provider.

        Parameters:
        num_proposals (int): The number of proposals to fetch. Default is 10.

        Returns:
        list: A list of treasury proposals.
        """
        pass

    def _determine_usd_price_factory(self, date_column, status_column=None):
        # assumes that the ticker is present as key in the row
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
