import { addMonths } from "date-fns";

/**
 * Returns the effective invoice date for a card purchase.
 *
 * Rule: if the purchase day is on or after the card's closing day,
 * the expense belongs to the next month's invoice; otherwise it stays
 * in the current month's invoice.
 *
 * Examples:
 *   - Closing day 5, purchase on day 4 → same month
 *   - Closing day 5, purchase on day 5 → next month
 *   - Closing day 5, purchase on day 10 → next month
 *
 * @param purchaseDateStr - ISO date string of the purchase (YYYY-MM-DD)
 * @param diaFechamento   - Closing day of the card (1–31)
 * @returns ISO date string representing the invoice date (YYYY-MM-DD)
 */
export function getEffectiveInvoiceDate(purchaseDateStr: string, diaFechamento: number): string {
  const purchaseDate = new Date(purchaseDateStr + "T00:00:00");
  if (purchaseDate.getDate() >= diaFechamento) {
    // Use local date components to avoid UTC offset shifting the date
    const next = addMonths(purchaseDate, 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, "0");
    const d = String(next.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return purchaseDateStr;
}
