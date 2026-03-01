import { describe, it, expect } from "vitest";

/**
 * Billing date logic: if a card purchase is made AFTER the card's closing date,
 * the first installment falls into the NEXT month's invoice.
 *
 * This function mirrors the logic in NovoLancamentoModal.tsx.
 */
function getEffectiveInvoiceDate(purchaseDateStr: string, diaFechamento: number): string {
  const purchaseDate = new Date(purchaseDateStr + "T00:00:00");
  if (purchaseDate.getDate() > diaFechamento) {
    const next = new Date(purchaseDate);
    next.setMonth(next.getMonth() + 1);
    return next.toISOString().split("T")[0];
  }
  return purchaseDateStr;
}

describe("Billing date logic", () => {
  it("purchase before closing date stays in same month", () => {
    // Card closes on day 10; purchase on Feb 5 → stays in February
    const result = getEffectiveInvoiceDate("2026-02-05", 10);
    expect(result).toBe("2026-02-05");
  });

  it("purchase on closing date stays in same month", () => {
    // Card closes on day 2; purchase on Feb 2 → stays in February
    const result = getEffectiveInvoiceDate("2026-02-02", 2);
    expect(result).toBe("2026-02-02");
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
});
