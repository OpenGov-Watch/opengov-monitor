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
        ['title', 'Status', 'DOT', 'USD_proposal_time', 'Track', 'tally_ayes', 'tally_nays', 'created', 'last_status_change', 'USD_latest']
        """
        pass

    @abstractmethod
    def fetch_treasury_spends(self, num_proposals=10):
        """
        Fetch a list of treasury proposals from the data provider.

        Parameters:
        num_proposals (int): The number of proposals to fetch. Default is 10.

        Returns:
        list: A list of treasury proposals.
        """
        pass