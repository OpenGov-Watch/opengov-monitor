class NetworkInfo:
    def __init__(self, network = "polkadot", explorer = "subsquare"):
        self.name = network
        if network == "polkadot":
            self.digits = 10
            self.ticker = "DOT"
        else:
            self.digits = 12
            self.ticker = "KSM"

        self.denomination_factor = 10**self.digits

        if explorer == "polkassembly":
            self.treasury_url = f"https://{network}.polkassembly.io/treasury/"
            self.child_bounty_url = f"https://{network}.polkassembly.io/bounties/"
        else:
            self.treasury_url = f"https://{network}.subsquare.io/treasury/proposals/"
            self.child_bounty_url = f"https://{network}.subsquare.io/treasury/child-bounties/"

        self.referenda_url = f"https://{network}.{explorer}.io/referenda/"