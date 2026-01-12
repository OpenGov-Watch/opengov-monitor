"""
Statescan ID Service API Provider
=================================

This module interfaces with the Statescan ID service to resolve blockchain addresses 
to human-readable names and identities.

API ENDPOINT:
URL: https://id.statescan.io/polkadot/short-ids
Method: POST  
Body: {"addresses": ["address1", "address2", ...]}
Returns: Array of objects with address and identity information

Response Format:
[
  {
    "address": "16a357f5Sxab3V2ne4emGQvqJaCLeYpTMx3TCjnQhmJQ71DX",
    "info": {
      "status": "VERIFIED", 
      "display": "OLIVER ⚡"
    }
  }
]
"""

import requests
import logging


class StatescanIdProvider:
    """Provider for resolving blockchain addresses to human-readable names."""

    def __init__(self, network="polkadot"):
        """
        Initialize the Statescan ID provider.
        
        Args:
            network (str): Network name (default: polkadot)
        """
        self.network = network
        self.base_url = f"https://id.statescan.io/{network}/short-ids"
        self._logger = logging.getLogger(__name__)

    def resolve_addresses(self, addresses):
        """
        Resolve blockchain addresses to human-readable names.
        
        Args:
            addresses (list): List of blockchain addresses to resolve
            
        Returns:
            dict: Mapping of address to name (empty string if no name found)
        """
        if not addresses:
            return {}
            
        payload = {"addresses": list(addresses)}
        
        self._logger.debug(f"Resolving {len(addresses)} addresses to names")
        
        try:
            response = requests.post(self.base_url, json=payload, timeout=30)
            self._logger.debug(f"Name resolution response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self._logger.debug(f"Name resolution response length: {len(data) if data else 0}")
                
                # Create address to name mapping
                name_mapping = {}
                for item in data:
                    if isinstance(item, dict):
                        address = item.get('address', '')
                        # Extract name from the info object
                        info = item.get('info', {})
                        if isinstance(info, dict):
                            display = info.get('display', '') or ''
                            legal = info.get('legal', '') or ''
                            web = info.get('web', '') or ''
                        else:
                            display = legal = web = ''
                        
                        # Clean any problematic Unicode characters
                        name = display or legal or web
                        if name:
                            # Replace problematic Unicode with safe alternatives  
                            name = name.encode('ascii', 'replace').decode('ascii')
                        
                        name_mapping[address] = name
                
                # Ensure all requested addresses have an entry (empty string if no name)
                for addr in addresses:
                    if addr not in name_mapping:
                        name_mapping[addr] = ''
                
                resolved_count = sum(1 for name in name_mapping.values() if name)
                self._logger.info(f"Resolved {resolved_count}/{len(addresses)} addresses to names")
                return name_mapping
            else:
                self._logger.warning(f"Name resolution failed: {response.status_code} {response.reason}")
                return {addr: '' for addr in addresses}
        except Exception as e:
            self._logger.warning(f"Exception during name resolution: {e}")
            return {addr: '' for addr in addresses}

    def resolve_single_address(self, address):
        """
        Resolve a single blockchain address to a human-readable name.
        
        Args:
            address (str): Blockchain address to resolve
            
        Returns:
            str: Human-readable name or empty string if not found
        """
        result = self.resolve_addresses([address])
        return result.get(address, '')