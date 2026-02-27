export interface ParsedNotification {
  valor?: number;
  loja?: string;
  descricao?: string;
}

/**
 * Parses a pasted bank SMS or push notification text and extracts
 * the transaction amount, merchant name, and a description.
 * Supports common Brazilian bank notification formats.
 */
export function parseBankNotification(text: string): ParsedNotification {
  const result: ParsedNotification = {};
  if (!text?.trim()) return result;

  // ── Amount extraction ──────────────────────────────────────────────────────
  // Matches: R$ 1.234,56 | R$1234,56 | R$ 1234.56 | R$50.00
  const amountMatch = text.match(/R\$\s*([\d.,]+)/i);
  if (amountMatch) {
    let raw = amountMatch[1];
    if (raw.includes(",")) {
      // BR format: 1.234,56 → 1234.56
      raw = raw.replace(/\./g, "").replace(",", ".");
    }
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) {
      result.valor = parsed;
    }
  }

  // ── Merchant extraction ────────────────────────────────────────────────────
  // Ordered by specificity; first match wins.
  const merchantPatterns: RegExp[] = [
    // "compra aprovada de R$ X em MERCHANT" — Nubank, Itaú, etc.
    /compra\s+(?:aprovada?|autorizada?|realizada?|efetuada?)(?:\s+(?:de|no\s+valor\s+de)\s+R\$[^\n]+?)?\s+(?:em|na|no)\s+([^\n\r.]{3,40}?)(?:\s+R\$|\s+no\s+valor|\s+aprovad|\s*[.\n]|$)/i,
    // "débito/crédito em MERCHANT" — generic
    /(?:d[eé]bito|cr[eé]dito|pagamento|compra)\s+(?:realizado[as]?\s+)?(?:em|na|no)\s+([^\n\rR$.]{3,40}?)(?:\s+R\$|\s+no\s+valor|\s*[.\n]|$)/i,
    // "MERCHANT R$" — ALL-CAPS merchant before the amount
    /^([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s]{2,39}?)\s+R\$/im,
    // "Lançamento em MERCHANT"
    /lan[çc]amento\s+em\s+([^\n\rR$.]{3,40}?)(?:\s+R\$|\s*[.\n]|$)/i,
    // "debitado de MERCHANT"
    /debitado\s+(?:de\s+)?([^\n\rR$.]{3,40}?)(?:\s+R\$|\s*[.\n]|$)/i,
  ];

  for (const pattern of merchantPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const merchant = match[1].trim().replace(/\s+/g, " ");
      if (merchant.length >= 3 && merchant.length <= 50) {
        result.loja = merchant;
        result.descricao = `Compra em ${merchant}`;
        break;
      }
    }
  }

  if (!result.descricao && result.valor) {
    result.descricao = "Compra";
  }

  return result;
}
