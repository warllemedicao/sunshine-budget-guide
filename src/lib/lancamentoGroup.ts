import { getEffectiveInvoiceDate } from "./billingDate";
import type { TablesInsert } from "@/integrations/supabase/types";

export const RECEIPT_COLUMNS = [
  "comprovante_url",
  "comprovante",
  "anexo_url",
  "anexo",
  "receipt_url",
] as const;

export type ReceiptColumn = (typeof RECEIPT_COLUMNS)[number];

export const DEFAULT_RECEIPT_COLUMN: ReceiptColumn = "comprovante_url";

export function getFirstReceiptUrlFromRow(row: Record<string, unknown>): string | null {
  for (const col of RECEIPT_COLUMNS) {
    const value = row[col];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

export type BuildParcelamentoArgs = {
  usuario_id: string;
  descricao: string;
  valor: number;
  dataCompra: string; // YYYY-MM-DD
  categoria: string;
  cartao_id: string | null;
  loja: string;
  merchant_id: string | null;
  merchant_logo_url: string | null;
  numParcelas: number;
  recorrencia_id: string;
  diaFechamento: number;
  receiptUrl?: string | null;
};

export function buildParcelamentoLancamentos(args: BuildParcelamentoArgs): TablesInsert<"lancamentos">[] {
  const {
    usuario_id,
    descricao,
    valor,
    dataCompra,
    categoria,
    cartao_id,
    loja,
    merchant_id,
    merchant_logo_url,
    numParcelas,
    recorrencia_id,
    diaFechamento,
    receiptUrl,
  } = args;

  const valorParcela = +(valor / numParcelas).toFixed(2);
  const receiptValue = receiptUrl ?? null;

  return Array.from({ length: numParcelas }, (_, i) => {
    const compraDate = new Date(dataCompra + "T00:00:00");
    compraDate.setMonth(compraDate.getMonth() + i);
    const compraDateIso = compraDate.toISOString().split("T")[0];
    const effectiveData = getEffectiveInvoiceDate(compraDateIso, diaFechamento);

    return {
      usuario_id,
      descricao: `${descricao} (${i + 1}/${numParcelas})`,
      valor: valorParcela,
      data: effectiveData,
      data_compra: compraDateIso,
      tipo: "despesa",
      categoria,
      fixa: false,
      cartao_id,
      parcela_atual: i + 1,
      parcelas: numParcelas,
      recorrencia_id,
      loja,
      merchant_id,
      merchant_logo_url,
      [DEFAULT_RECEIPT_COLUMN]: receiptValue,
    } as unknown as TablesInsert<"lancamentos">;
  });
}
