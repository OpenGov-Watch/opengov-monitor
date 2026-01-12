// Subsquare URL generators for Polkadot governance
export const subsquareUrls = {
  referenda: (id: number) => `https://polkadot.subsquare.io/referenda/${id}`,
  treasury: (id: number) =>
    `https://polkadot.subsquare.io/treasury/spends/${id}`,
  childBounty: (identifier: string) =>
    `https://polkadot.subsquare.io/treasury/child-bounties/${identifier}`,
  fellowship: (id: number) =>
    `https://collectives.subsquare.io/fellowship/treasury/spends/${id}`,
  fellowshipSubtreasury: (id: number) =>
    `https://collectives.subsquare.io/fellowship/treasury/spends/${id}`,
  salaryCycle: (cycle: number) =>
    `https://collectives.subsquare.io/fellowship/salary/cycles/${cycle}`,
};
