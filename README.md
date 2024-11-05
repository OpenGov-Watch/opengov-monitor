# Monitoring Updater

  python -m venv venv
  venv/scripts/activate
  pip install -r requirements.txt

# Summary
This script fetches Treasury proposals from Polkassembly and updates them on a Google Spreadsheet.

## Instructions
1. Create a service account: https://developers.google.com/workspace/guides/create-credentials
2. Create a Google spreadsheet. The sheet has to have the name "Referenda". Copy the header titles from the [existing monitoring sheet](https://opengov.watch/monitoring)
3. in the first code block, do the following:
  - set the `network` (lower caps, only `polkadot` or `kusama`)
  - set the `spreadsheet_name` to the one you created in step 2
  - set the `explorer` to be used in links (lower caps, only `polkassembly` or `subsquare`)
  - check if the amount of referenda to fetch is good for you. Either set it to a large number to fetch all, or to a smaller number to limit the load on the API
4. in the menu above click **Runtime -> Run all**
  - an info box pops up: **Run anyway**
5. wait half a minute (the wheels in the code boxes will stop turning when done)
6. review the spreadsheet file
  - make sure column A is a whole number. If it isn't future updates won't work. Make it a whole number by setting `Format->Number->Automatic`.

## Notes
- Data is fetched from Polkassembly.
- USD prices of executed proposals are calculated to the exchange rate of the day of the last status change.
- Not every referendum gets a DOT value assigned from Polkassembly. E.g. Bounties are not counted, since the money is not spent. We also see proposals without value where we don't have an explanation yet, e.g. 465