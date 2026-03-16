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

    it("does not overflow months when purchase day is 31 (regression: setMonth bug)", () => {
      // Compra em 31/07 (julho tem 31 dias), fechamento 5.
      // Julho 31 >= 5 → avança para agosto 31 (agosto tem 31 dias).
      // Com setMonth nativo, agosto 31 + 1 mês → setembro 31 → overfloeia para outubro 1.
      // Com addMonths do date-fns, agosto 31 + 1 → setembro 30 (clampado).
      const inserts = buildParcelamentoLancamentos({
        usuario_id: "user-1",
        descricao: "Compra 31",
        valor: 600,
        dataCompra: "2026-07-31",
        categoria: "outros",
        cartao_id: "cartao-1",
        loja: "Loja X",
        merchant_id: null,
        merchant_logo_url: null,
        numParcelas: 6,
        recorrencia_id: "recorrencia-3",
        diaFechamento: 5,
      });

      expect(inserts.length).toBe(6);
      // Cada parcela deve cair em um mês distinto e sequencial
      const meses = inserts.map((r) => (r.data as string).substring(0, 7));
      expect(meses[0]).toBe("2026-08");
      expect(meses[1]).toBe("2026-09");
      expect(meses[2]).toBe("2026-10");
      expect(meses[3]).toBe("2026-11");
      expect(meses[4]).toBe("2026-12");
      expect(meses[5]).toBe("2027-01");
      // Sem duplicatas
      const unique = new Set(meses);
      expect(unique.size).toBe(6);
    });
});
