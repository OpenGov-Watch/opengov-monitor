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

    def _determine_usd_price_factory(self, date_key, status_key=None):
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
        def determine_usd_price(row):
            statuses_where_i_want_to_get_the_historic_price = ["Executed", "TimedOut", "Approved", "Cancelled", "Rejected"]
            if (status_key is None) or row[status_key] in statuses_where_i_want_to_get_the_historic_price:
                # use the historic price
                executed_date = row[date_key]
                conversion_rate = self.price_service.get_historic_price(executed_date)
                return row[self.network_info.ticker] * conversion_rate
            else:
                if self.price_service.current_price is None:
                    raise ValueError("Current price not available. Call get_current_price() first.")
                return row[self.network_info.ticker] * self.price_service.current_price

        return determine_usd_price
