import { describe, it, expect } from "vitest";
import { buildParcelamentoLancamentos, DEFAULT_RECEIPT_COLUMN } from "@/lib/lancamentoGroup";

describe("buildParcelamentoLancamentos", () => {
  it("applies receiptUrl to all generated parcels", () => {
    const inserts = buildParcelamentoLancamentos({
      usuario_id: "user-1",
      descricao: "Compra teste",
      valor: 100,
      dataCompra: "2026-01-10",
      categoria: "outros",
      cartao_id: "cartao-1",
      loja: "Loja X",
      merchant_id: "merchant-1",
      merchant_logo_url: "https://example.com/logo.png",
      numParcelas: 3,
      recorrencia_id: "recorrencia-1",
      diaFechamento: 5,
      receiptUrl: "https://example.com/comprovante.pdf",
    });

    expect(inserts.length).toBe(3);
    for (const item of inserts) {
      expect(item[DEFAULT_RECEIPT_COLUMN]).toBe("https://example.com/comprovante.pdf");
    }
  });

  it("applies billing-date rule for each parcel", () => {
    const inserts = buildParcelamentoLancamentos({
      usuario_id: "user-1",
      descricao: "Compra teste",
      valor: 120,
      dataCompra: "2026-02-04",
      categoria: "outros",
      cartao_id: "cartao-1",
      loja: "Loja X",
      merchant_id: "merchant-1",
      merchant_logo_url: "https://example.com/logo.png",
      numParcelas: 3,
      recorrencia_id: "recorrencia-2",
      diaFechamento: 5,
    });

    // Compra em 04/02 fecha dia 5 => ainda pertence a fatura de fevereiro.
    expect(inserts[0].data).toBe("2026-02-04");
    // Parcela 2 em 04/03 (março), fechamento 5 -> permanece em março
    expect(inserts[1].data).toBe("2026-03-04");
    // Parcela 3 em 04/04 (abril)
    expect(inserts[2].data).toBe("2026-04-04");
  });
});
