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

/**
 * Generate URL for all_spending rows based on spending type and ID.
 *
 * ID formats and their URLs:
 * - ref-{id}      -> polkadot.subsquare.io/referenda/{id}
 * - treasury-{id} -> polkadot.subsquare.io/treasury/spends/{id}
 * - cb-{identifier} -> polkadot.subsquare.io/treasury/child-bounties/{identifier}
 * - sub-{id}      -> polkadot.subsquare.io/treasury/spends/{id}
 * - fs-{cycle}    -> collectives.subsquare.io/fellowship/salary/cycles/{cycle}
 * - fg-{id}       -> collectives.subsquare.io/fellowship/treasury/spends/{id}
 * - custom-{id}   -> null (internal only)
 *
 * @param id The spending ID with prefix (e.g., "ref-123", "cb-456-7")
 * @returns The Subsquare URL or null if no URL should be generated
 */
export function getSpendingUrl(id: string): string | null {
  if (!id || typeof id !== "string") return null;

  // Direct Spend: ref-{id}
  if (id.startsWith("ref-")) {
    const numericId = parseInt(id.slice(4), 10);
    if (!isNaN(numericId)) {
      return subsquareUrls.referenda(numericId);
    }
  }

  // Claim: treasury-{id}
  if (id.startsWith("treasury-")) {
    const numericId = parseInt(id.slice(9), 10);
    if (!isNaN(numericId)) {
      return subsquareUrls.treasury(numericId);
    }
  }

  // Bounty: cb-{identifier} (identifier can be like "456-7")
  if (id.startsWith("cb-")) {
    const identifier = id.slice(3);
    if (identifier) {
      return subsquareUrls.childBounty(identifier);
    }
  }

  // Subtreasury: sub-{id}
  if (id.startsWith("sub-")) {
    const numericId = parseInt(id.slice(4), 10);
    if (!isNaN(numericId)) {
      return subsquareUrls.treasury(numericId);
    }
  }

  // Fellowship Salary: fs-{cycle}
  if (id.startsWith("fs-")) {
    const cycle = parseInt(id.slice(3), 10);
    if (!isNaN(cycle)) {
      return subsquareUrls.salaryCycle(cycle);
    }
  }

  // Fellowship Grants: fg-{id}
  if (id.startsWith("fg-")) {
    const numericId = parseInt(id.slice(3), 10);
    if (!isNaN(numericId)) {
      return subsquareUrls.fellowship(numericId);
    }
  }

  // Custom Spending: custom-{id} - no external URL
  if (id.startsWith("custom-")) {
    return null;
  }

  return null;
}
