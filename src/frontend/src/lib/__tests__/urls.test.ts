/**
 * URL Generator Tests
 *
 * Tests for URL generation functions, particularly getSpendingUrl
 * which maps spending IDs to their Subsquare URLs.
 */

import { describe, it, expect } from "vitest";
import { getSpendingUrl, subsquareUrls } from "../urls";

describe("subsquareUrls", () => {
  it("generates referenda URLs", () => {
    expect(subsquareUrls.referenda(123)).toBe(
      "https://polkadot.subsquare.io/referenda/123"
    );
  });

  it("generates treasury URLs", () => {
    expect(subsquareUrls.treasury(456)).toBe(
      "https://polkadot.subsquare.io/treasury/spends/456"
    );
  });

  it("generates child bounty URLs", () => {
    expect(subsquareUrls.childBounty("789-10")).toBe(
      "https://polkadot.subsquare.io/treasury/child-bounties/789-10"
    );
  });

  it("generates fellowship URLs", () => {
    expect(subsquareUrls.fellowship(111)).toBe(
      "https://collectives.subsquare.io/fellowship/treasury/spends/111"
    );
  });

  it("generates salary cycle URLs", () => {
    expect(subsquareUrls.salaryCycle(5)).toBe(
      "https://collectives.subsquare.io/fellowship/salary/cycles/5"
    );
  });
});

describe("getSpendingUrl", () => {
  describe("Direct Spend (ref-{id})", () => {
    it("generates URL for ref- prefix", () => {
      expect(getSpendingUrl("ref-123")).toBe(
        "https://polkadot.subsquare.io/referenda/123"
      );
    });

    it("handles large referendum IDs", () => {
      expect(getSpendingUrl("ref-1234567")).toBe(
        "https://polkadot.subsquare.io/referenda/1234567"
      );
    });

    it("returns null for ref- with non-numeric ID", () => {
      expect(getSpendingUrl("ref-abc")).toBe(null);
    });

    it("returns null for ref- with empty ID", () => {
      expect(getSpendingUrl("ref-")).toBe(null);
    });
  });

  describe("Claim (treasury-{id})", () => {
    it("generates URL for treasury- prefix", () => {
      expect(getSpendingUrl("treasury-456")).toBe(
        "https://polkadot.subsquare.io/treasury/spends/456"
      );
    });

    it("returns null for treasury- with non-numeric ID", () => {
      expect(getSpendingUrl("treasury-xyz")).toBe(null);
    });
  });

  describe("Bounty (cb-{identifier})", () => {
    it("generates URL for cb- prefix with simple identifier", () => {
      expect(getSpendingUrl("cb-123")).toBe(
        "https://polkadot.subsquare.io/treasury/child-bounties/123"
      );
    });

    it("generates URL for cb- prefix with compound identifier", () => {
      expect(getSpendingUrl("cb-456-7")).toBe(
        "https://polkadot.subsquare.io/treasury/child-bounties/456-7"
      );
    });

    it("generates URL for cb- with complex identifier", () => {
      expect(getSpendingUrl("cb-100-25-3")).toBe(
        "https://polkadot.subsquare.io/treasury/child-bounties/100-25-3"
      );
    });

    it("returns null for cb- with empty identifier", () => {
      expect(getSpendingUrl("cb-")).toBe(null);
    });
  });

  describe("Subtreasury (sub-{id})", () => {
    it("generates URL for sub- prefix", () => {
      expect(getSpendingUrl("sub-789")).toBe(
        "https://polkadot.subsquare.io/treasury/spends/789"
      );
    });

    it("returns null for sub- with non-numeric ID", () => {
      expect(getSpendingUrl("sub-abc")).toBe(null);
    });
  });

  describe("Fellowship Salary (fs-{cycle})", () => {
    it("generates URL for fs- prefix", () => {
      expect(getSpendingUrl("fs-5")).toBe(
        "https://collectives.subsquare.io/fellowship/salary/cycles/5"
      );
    });

    it("handles larger cycle numbers", () => {
      expect(getSpendingUrl("fs-42")).toBe(
        "https://collectives.subsquare.io/fellowship/salary/cycles/42"
      );
    });

    it("returns null for fs- with non-numeric cycle", () => {
      expect(getSpendingUrl("fs-alpha")).toBe(null);
    });
  });

  describe("Fellowship Grants (fg-{id})", () => {
    it("generates URL for fg- prefix", () => {
      expect(getSpendingUrl("fg-12")).toBe(
        "https://collectives.subsquare.io/fellowship/treasury/spends/12"
      );
    });

    it("returns null for fg- with non-numeric ID", () => {
      expect(getSpendingUrl("fg-beta")).toBe(null);
    });
  });

  describe("Custom Spending (custom-{id})", () => {
    it("returns null for custom- prefix (no external URL)", () => {
      expect(getSpendingUrl("custom-1")).toBe(null);
    });

    it("returns null for any custom- ID", () => {
      expect(getSpendingUrl("custom-abc-123")).toBe(null);
    });
  });

  describe("Edge cases", () => {
    it("returns null for empty string", () => {
      expect(getSpendingUrl("")).toBe(null);
    });

    it("returns null for null input", () => {
      expect(getSpendingUrl(null as unknown as string)).toBe(null);
    });

    it("returns null for undefined input", () => {
      expect(getSpendingUrl(undefined as unknown as string)).toBe(null);
    });

    it("returns null for unknown prefix", () => {
      expect(getSpendingUrl("unknown-123")).toBe(null);
    });

    it("returns null for ID without prefix", () => {
      expect(getSpendingUrl("123")).toBe(null);
    });

    it("returns null for number input", () => {
      expect(getSpendingUrl(123 as unknown as string)).toBe(null);
    });

    it("returns null for partial prefix match", () => {
      // "reference-123" starts with "ref" but not "ref-"
      expect(getSpendingUrl("reference-123")).toBe(null);
    });
  });
});
