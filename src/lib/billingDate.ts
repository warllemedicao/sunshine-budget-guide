import { addMonths } from "date-fns";

/**
 * Returns the effective invoice date for a card purchase.
 *
 * Rule: if the purchase day is on or after the card's closing day,
 * the expense belongs to the next month's invoice; otherwise it stays
 * in the current month's invoice.
 *
 * @param purchaseDateStr - ISO date string of the purchase (YYYY-MM-DD)
 * @param diaFechamento   - Closing day of the card (1–31)
 * @returns ISO date string representing the invoice date
 */
export function getEffectiveInvoiceDate(purchaseDateStr: string, diaFechamento: number): string {
  const purchaseDate = new Date(purchaseDateStr + "T00:00:00");
  if (purchaseDate.getDate() >= diaFechamento) {
    return addMonths(purchaseDate, 1).toISOString().split("T")[0];
  }
  return purchaseDateStr;
}
