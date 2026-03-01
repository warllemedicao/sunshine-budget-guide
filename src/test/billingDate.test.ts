import { describe, it, expect } from "vitest";
import { getEffectiveInvoiceDate } from "@/lib/billingDate";

/**
 * Tests for the billing date closing-date rule defined in @/lib/billingDate.
 */

describe("Billing date logic", () => {
  it("purchase before closing date stays in same month", () => {
    // Card closes on day 10; purchase on Feb 5 → stays in February
    const result = getEffectiveInvoiceDate("2026-02-05", 10);
    expect(result).toBe("2026-02-05");
  });

  it("purchase on closing date moves to next month", () => {
    // Card closes on day 2; purchase on Feb 2 → the invoice is already
    // closed that day, so the purchase belongs to the March invoice
    const result = getEffectiveInvoiceDate("2026-02-02", 2);
    expect(result).toBe("2026-03-02");
  });

  it("purchase after closing date moves to next month", () => {
    // Card closes on day 2; purchase on Feb 6 → moves to March
    const result = getEffectiveInvoiceDate("2026-02-06", 2);
    expect(result).toBe("2026-03-06");
  });

  it("purchase after closing date at end of year moves to next year", () => {
    // Card closes on day 10; purchase on Dec 15 → moves to January next year
    const result = getEffectiveInvoiceDate("2025-12-15", 10);
    expect(result).toBe("2026-01-15");
  });

  it("purchase after closing date at end of month", () => {
    // Card closes on day 20; purchase on Jan 25 → moves to February
    const result = getEffectiveInvoiceDate("2026-01-25", 20);
    expect(result).toBe("2026-02-25");
  });

  it("purchase after closing date with month-end overflow clamps to last day", () => {
    // Card closes on day 15; purchase on Jan 31 → moves to Feb 28 (not March 3)
    const result = getEffectiveInvoiceDate("2026-01-31", 15);
    expect(result).toBe("2026-02-28");
  });
});
