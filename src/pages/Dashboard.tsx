import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import MonthSelector from "@/components/MonthSelector";
import NovoLancamentoModal from "@/components/NovoLancamentoModal";
import { formatCurrency } from "@/lib/formatters";
import { getCategoriaInfo } from "@/lib/categories";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  TrendingUp, TrendingDown, CreditCard, ShoppingBag,
  ChevronDown, ChevronUp, Plus, Trash2, Edit2, Check, Undo2, Paperclip,
} from "lucide-react";
import { ReceiptUploadButton } from '@/components/ReceiptUploadButton';
import { ReceiptViewer } from '@/components/ReceiptViewer';
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { useShareTarget } from "@/hooks/useShareTarget";
import BrandLogo from "@/components/BrandLogo";
import Onboarding from "@/components/Onboarding";
import { DEFAULT_USER_FEATURE_SETTINGS, readSettingsFromStorage } from "@/lib/userSettings";

const getInstallmentBaseDescription = (descricao: string): string => descricao.replace(/ \(\d+\/\d+\)$/, "");

const RECEIPT_COLUMNS = ["comprovante_url", "comprovante", "anexo_url", "anexo", "receipt_url"] as const;

const getDbComprovanteUrl = (row: unknown): string | null => {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  for (const col of RECEIPT_COLUMNS) {
    const value = record[col];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
};

const LANCAMENTO_RECEIPT_KEY = "receipt:lancamento:";
const FATURA_RECEIPT_KEY = "receipt:fatura:";
const FIXED_EXPENSE_PAID_KEY = "fixed-expense-paid:";

const getLocalReceipt = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const setLocalReceipt = (key: string, value: string | null) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore localStorage failures
  }
};

const isUnknownColumnError = (error: unknown, column: string): boolean => {
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return e.code === "42703" && msg.includes(column.toLowerCase());
};

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [editItem, setEditItem] = useState<Tables<"lancamentos"> | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showPagarModal, setShowPagarModal] = useState(false);
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptLancamento, setReceiptLancamento] = useState<Tables<"lancamentos"> | null>(null);
  const [receiptRefreshTick, setReceiptRefreshTick] = useState(0);
  const [fixedExpensePaidMap, setFixedExpensePaidMap] = useState<Record<string, boolean>>({});
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "com-anexo" | "sem-anexo" | "fixas" | "variaveis">("all");
  const [advancedCategory, setAdvancedCategory] = useState<string>("all");
  const [advancedScope, setAdvancedScope] = useState<"all" | "receitas" | "despesas">("all");
  const [featureSettings, setFeatureSettings] = useState(DEFAULT_USER_FEATURE_SETTINGS);

  const { sharedFile, clearSharedFile } = useShareTarget();
  const fixedExpenseStorageKey = `${FIXED_EXPENSE_PAID_KEY}${user?.id ?? "anon"}:${mes + 1}:${ano}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fixedExpenseStorageKey);
      setFixedExpensePaidMap(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setFixedExpensePaidMap({});
    }
  }, [fixedExpenseStorageKey]);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("sunshine-budget-onboarding");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setFeatureSettings(DEFAULT_USER_FEATURE_SETTINGS);
      return;
    }
    setFeatureSettings(readSettingsFromStorage(user.id));
  }, [user?.id]);

  const toggleFixedExpensePaid = (lancamentoId: string) => {
    setFixedExpensePaidMap((prev) => {
      const next = { ...prev, [lancamentoId]: !prev[lancamentoId] };
      try {
        localStorage.setItem(fixedExpenseStorageKey, JSON.stringify(next));
      } catch {
        // ignore localStorage failures
      }
      return next;
    });
  };

  // Auto-open the new transaction modal when the app receives a shared receipt
  useEffect(() => {
    if (sharedFile && user) {
      setEditItem(null);
      setShowEdit(true);
    }
  }, [sharedFile, user]);

  const startDate = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const endDate = mes === 11 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 2).padStart(2, "0")}-01`;

  const { data: lancamentos = [], isLoading: lancamentosLoading } = useQuery({
    queryKey: ["lancamentos", user?.id, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase.from("lancamentos").select("*")
        .eq("usuario_id", user!.id).gte("data", startDate).lt("data", endDate)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cartoes = [], isSuccess: cartoesLoaded } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").eq("usuario_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: faturas = [] } = useQuery({
    queryKey: ["faturas", user?.id, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase.from("faturas").select("*").eq("usuario_id", user!.id)
        .eq("mes", mes + 1).eq("ano", ano);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const normalizeTipo = (l: Tables<"lancamentos">): "receita" | "despesa" => {
      const rawTipo = (l.tipo ?? "").toString().trim().toLowerCase();
      if (rawTipo === "receita" || rawTipo === "entrada") return "receita";
      if (rawTipo === "despesa" || rawTipo === "saida") return "despesa";

      // Compatibilidade com dados antigos: em alguns cenarios receitas eram salvas com valor negativo.
      if (l.valor < 0) return "receita";
      return "despesa";
    };

    const isReceitaLancamento = (l: Tables<"lancamentos">) => normalizeTipo(l) === "receita";
    const receitas = lancamentos.filter((l) => isReceitaLancamento(l));
    const despesas = lancamentos.filter((l) => !isReceitaLancamento(l));
    const totalReceita = receitas.reduce((s, l) => s + Math.abs(l.valor), 0);
    const totalDespesa = despesas
      .filter((l) => featureSettings.excludeFixedCardFromTotals ? !(l.fixa && !!l.cartao_id) : true)
      .reduce((s, l) => s + Math.abs(l.valor), 0);
    const fixasReceita = receitas.filter((l) => l.fixa && !l.cartao_id);
    const variaveisReceita = receitas.filter((l) => !l.fixa && !l.cartao_id);
    const fixasDespesa = despesas.filter((l) => l.fixa && !l.cartao_id);
    const cartaoIds = new Set(cartoes.map((c) => c.id));
    const fixasCartao = despesas.filter((l) => l.fixa && !!l.cartao_id && cartaoIds.has(l.cartao_id));
    // Only include variable card expenses that are linked to an existing card
    const cartaoLanc = despesas.filter((l) => !l.fixa && !!l.cartao_id && cartaoIds.has(l.cartao_id));
    const variaveis = despesas.filter((l) => !l.fixa && !l.cartao_id);
    // Orphaned: has cartao_id but no valid card
    const orfaos = cartoesLoaded
      ? despesas.filter((l) => !!l.cartao_id && !cartaoIds.has(l.cartao_id))
      : [];
    return { totalReceita, totalDespesa, fixasReceita, variaveisReceita, fixasDespesa, fixasCartao, cartaoLanc, variaveis, orfaos };
  }, [lancamentos, cartoes, cartoesLoaded, featureSettings.excludeFixedCardFromTotals]);

  const saldo = stats.totalReceita - stats.totalDespesa;
  const pctGasto = stats.totalReceita > 0
    ? Math.min(100, Math.round((stats.totalDespesa / stats.totalReceita) * 100)) : 0;

  const openEdit = (item: Tables<"lancamentos">) => {
    setEditItem(item);
    setShowEdit(true);
  };


  // Group card expenses by card, including cards with no expenses
  const cartaoGroups = useMemo(() => {
    const groups = new Map<string, { cartao: Tables<"cartoes">; total: number; pago: boolean; fatura: Tables<"faturas"> | null; compras: Tables<"lancamentos">[] }>();

    // Init all cards
    cartoes.forEach((c) => {
      const fatura = faturas.find((f) => f.cartao_id === c.id);
      groups.set(c.id, { cartao: c, total: 0, pago: fatura?.status === "pago", fatura: fatura ?? null, compras: [] });
    });

    stats.cartaoLanc.forEach((l) => {
      if (!l.cartao_id) return;
      const g = groups.get(l.cartao_id);
      if (g) {
        g.total += l.valor;
        g.compras.push(l);
      }
    });

    return Array.from(groups.values());
  }, [stats.cartaoLanc, cartoes, faturas]);

  const fixasCartaoGroups = useMemo(() => {
    const groups = new Map<string, { cartao: Tables<"cartoes">; pago: boolean; itens: Tables<"lancamentos">[] }>();

    cartoes.forEach((c) => {
      const fatura = faturas.find((f) => f.cartao_id === c.id);
      groups.set(c.id, { cartao: c, pago: fatura?.status === "pago", itens: [] });
    });

    stats.fixasCartao.forEach((l) => {
      if (!l.cartao_id) return;
      const g = groups.get(l.cartao_id);
      if (g) g.itens.push(l);
    });

    return Array.from(groups.values()).filter((g) => g.itens.length > 0);
  }, [stats.fixasCartao, cartoes, faturas]);

  const deleteLancamento = useMutation({
    mutationFn: async (l: Tables<"lancamentos">) => {
      if (l.fixa && l.recorrencia_id && user) {
        const { data: backupRows } = await supabase
          .from("lancamentos")
          .select("*")
          .eq("usuario_id", user.id)
          .eq("recorrencia_id", l.recorrencia_id);
        const { error } = await supabase
          .from("lancamentos")
          .delete()
          .eq("usuario_id", user.id)
          .eq("recorrencia_id", l.recorrencia_id);
        if (error) throw error;
        return { deletedCount: 999, backupRows: backupRows ?? [] };
      }

      const isInstallment = !!l.parcela_atual && !!l.parcelas && !!l.cartao_id;
      if (isInstallment && user) {
        const baseDescricao = getInstallmentBaseDescription(l.descricao);
        const suffixPattern = new RegExp(`^${baseDescricao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d+\\/${l.parcelas}\\)$`);

        const { data: related, error: selectError } = await supabase
          .from("lancamentos")
          .select("id, descricao")
          .eq("usuario_id", user.id)
          .eq("cartao_id", l.cartao_id)
          .eq("parcelas", l.parcelas)
          .eq("data_compra", l.data_compra ?? l.data);
        if (selectError) throw selectError;

        const ids = (related ?? [])
          .filter((item) => suffixPattern.test(item.descricao))
          .map((item) => item.id);

        if (ids.length > 1) {
          const { data: backupRows } = await supabase.from("lancamentos").select("*").in("id", ids);
          const { error: deleteGroupError } = await supabase.from("lancamentos").delete().in("id", ids);
          if (deleteGroupError) throw deleteGroupError;
          return { deletedCount: ids.length, backupRows: backupRows ?? [] };
        }
      }

      const { error } = await supabase.from("lancamentos").delete().eq("id", l.id);
      if (error) throw error;
      return { deletedCount: 1, backupRows: [l] };
    },
    onSuccess: ({ deletedCount, backupRows }) => {
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      if ((deletedCount ?? 1) === 999) {
        toast({ title: "Recorrencia fixa removida!" });
      } else if ((deletedCount ?? 1) > 1) {
        toast({ title: `${deletedCount} parcelas removidas!` });
      } else {
        if (featureSettings.enableUndoAfterActions && backupRows.length === 1) {
          toast({
            title: "Compra removida!",
            description: "Você pode desfazer esta ação.",
            action: (
              <ToastAction
                altText="Desfazer"
                onClick={async () => {
                  const { error } = await supabase.from("lancamentos").insert(backupRows[0] as never);
                  if (!error) {
                    qc.invalidateQueries({ queryKey: ["lancamentos"] });
                    toast({ title: "Exclusão desfeita!" });
                  }
                }}
              >
                Desfazer
              </ToastAction>
            ),
          });
        } else {
          toast({ title: "Compra removida!" });
        }
      }
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro ao excluir", description: message, variant: "destructive" });
    },
  });

  const togglePago = useMutation({
    mutationFn: async ({ cartaoId, pago }: { cartaoId: string; pago: boolean }) => {
      const fatura = faturas.find((f) => f.cartao_id === cartaoId);
      if (pago) {
        // Undo payment
        if (fatura) {
          const { error } = await supabase.from("faturas").update({ status: "pendente" }).eq("id", fatura.id);
          if (error) throw error;
        }
      } else {
        // Open pay modal
        setPagarCartaoId(cartaoId);
        setShowPagarModal(true);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["faturas"] }),
  });

  const closingAlerts = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const day = today.getDate();
    return cartoes.filter(c => {
      if (mes + 1 !== currentMonth || ano !== currentYear) return false;
      return c.fechamento - day <= 3 && c.fechamento - day >= 0;
    });
  }, [cartoes, mes, ano]);

  const dueAlerts = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const day = today.getDate();
    return cartoes.filter(c => {
      if (mes + 1 !== currentMonth || ano !== currentYear) return false;
      return c.vencimento - day <= 3 && c.vencimento - day >= 0;
    });
  }, [cartoes, mes, ano]);

  const anomalyCount = useMemo(() => {
    const despesas = lancamentos.filter((l) => {
      const t = (l.tipo ?? "").toLowerCase();
      return t === "despesa" || t === "saida" || (t !== "receita" && t !== "entrada" && l.valor >= 0);
    });
    if (despesas.length < 3) return 0;
    const media = despesas.reduce((s, l) => s + Math.abs(l.valor), 0) / despesas.length;
    return despesas.filter((l) => Math.abs(l.valor) > media * 2).length;
  }, [lancamentos]);

  const missingReceiptCount = useMemo(
    () => lancamentos.filter((l) => {
      const t = (l.tipo ?? "").toLowerCase();
      const isDespesa = t === "despesa" || t === "saida" || (t !== "receita" && t !== "entrada" && l.valor >= 0);
      return isDespesa && !hasReceipt(l);
    }).length,
    [lancamentos],
  );

  const subscriptionHintCount = useMemo(
    () => lancamentos.filter((l) => l.fixa && ((l.tipo ?? "").toLowerCase() === "despesa" || (l.tipo ?? "").toLowerCase() === "saida")).length,
    [lancamentos],
  );

  const pendingImportCount = useMemo(() => {
    if (!user?.id) return 0;
    try {
      const raw = localStorage.getItem(`sunshine:import:pending:${user.id}`);
      return raw ? Number(raw) || 0 : 0;
    } catch {
      return 0;
    }
  }, [user?.id]);

  const hasReceipt = (l: Tables<"lancamentos">) => !!getDbComprovanteUrl(l) || !!getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${l.id}`);

  const applyDisplayFilters = (items: Tables<"lancamentos">[]) => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (term.length > 0) {
        const desc = (item.descricao ?? "").toLowerCase();
        const store = (item.loja ?? "").toLowerCase();
        if (!desc.includes(term) && !store.includes(term)) return false;
      }

      if (quickFilter === "com-anexo") return hasReceipt(item);
      if (quickFilter === "sem-anexo") return !hasReceipt(item);
      if (quickFilter === "fixas") return !!item.fixa;
      if (quickFilter === "variaveis") return !item.fixa;

      if (featureSettings.enableAdvancedFilters) {
        if (advancedCategory !== "all" && item.categoria !== advancedCategory) return false;
        const rawTipo = (item.tipo ?? "").toString().trim().toLowerCase();
        const isReceita = rawTipo === "receita" || rawTipo === "entrada" || (rawTipo !== "despesa" && rawTipo !== "saida" && item.valor < 0);
        if (advancedScope === "receitas" && !isReceita) return false;
        if (advancedScope === "despesas" && isReceita) return false;
      }
      return true;
    });
  };

  const fixasReceitaView = useMemo(() => applyDisplayFilters(stats.fixasReceita), [stats.fixasReceita, searchTerm, quickFilter]);
  const variaveisReceitaView = useMemo(() => applyDisplayFilters(stats.variaveisReceita), [stats.variaveisReceita, searchTerm, quickFilter]);
  const fixasDespesaView = useMemo(() => applyDisplayFilters(stats.fixasDespesa), [stats.fixasDespesa, searchTerm, quickFilter]);
  const variaveisView = useMemo(() => applyDisplayFilters(stats.variaveis), [stats.variaveis, searchTerm, quickFilter]);
  const orfaosView = useMemo(() => applyDisplayFilters(stats.orfaos), [stats.orfaos, searchTerm, quickFilter]);

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4">
      <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); setExpandedCard(null); }} />

      {featureSettings.notifyCardClosing && closingAlerts.length > 0 && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-warning-foreground">
              ⚠️ Fechamento próximo: {closingAlerts.map(c => c.nome).join(", ")} fecha{closingAlerts.length === 1 ? "" : "m"} no dia {closingAlerts[0].fechamento}.
            </p>
          </CardContent>
        </Card>
      )}

      {featureSettings.notifyCardDue && dueAlerts.length > 0 && (
        <Card className="border-primary/40 bg-primary/10">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-primary">
              📅 Vencimento próximo: {dueAlerts.map(c => c.nome).join(", ")} vence{dueAlerts.length === 1 ? "" : "m"} em breve.
            </p>
          </CardContent>
        </Card>
      )}

      {featureSettings.notifyAnomalies && anomalyCount > 0 && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-warning-foreground">⚠️ {anomalyCount} gasto(s) fora do padrão detectado(s).</p>
          </CardContent>
        </Card>
      )}

      {featureSettings.notifyMissingReceipt && missingReceiptCount > 0 && (
        <Card className="border-accent/60 bg-accent/10">
          <CardContent className="p-3">
            <p className="text-sm font-medium">📎 {missingReceiptCount} despesa(s) sem comprovante.</p>
          </CardContent>
        </Card>
      )}

      {featureSettings.notifySubscriptionCharges && subscriptionHintCount > 0 && (
        <Card className="border-secondary bg-secondary/60">
          <CardContent className="p-3">
            <p className="text-sm font-medium">🔁 {subscriptionHintCount} despesa(s) fixas podem ser assinaturas recorrentes.</p>
          </CardContent>
        </Card>
      )}

      {featureSettings.notifyImportPendingReview && pendingImportCount > 0 && (
        <Card className="border-primary/50 bg-primary/10">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-primary">🗂️ {pendingImportCount} item(ns) importado(s) aguardam revisão.</p>
          </CardContent>
        </Card>
      )}

      {/* Saldo */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <p className={cn("text-3xl font-bold", saldo >= 0 ? "text-success" : "text-destructive")}>
            {formatCurrency(saldo)}
          </p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{pctGasto}% gasto</span>
            <span className="text-muted-foreground">{formatCurrency(stats.totalDespesa)} / {formatCurrency(stats.totalReceita)}</span>
          </div>
          <Progress value={pctGasto} className="mt-2 h-2" />
          {featureSettings.excludeFixedCardFromTotals && stats.fixasCartao.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Despesas fixas no cartão são exibidas separadamente e não entram neste total.
            </p>
          )}
        </CardContent>
      </Card>

      {(featureSettings.enableSearchInicio || featureSettings.enableQuickFiltersInicio) && (
        <Card>
          <CardContent className="p-3 space-y-2">
            {featureSettings.enableSearchInicio && (
              <Input
                placeholder="Buscar por descrição ou loja"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
            {featureSettings.enableQuickFiltersInicio && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "all", label: "Tudo" },
                  { key: "com-anexo", label: "Com anexo" },
                  { key: "sem-anexo", label: "Sem anexo" },
                  { key: "fixas", label: "Fixas" },
                  { key: "variaveis", label: "Variáveis" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setQuickFilter(filter.key as typeof quickFilter)}
                    className={cn(
                      "rounded-full border px-2 py-1 text-[10px]",
                      quickFilter === filter.key ? "border-primary text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {featureSettings.enableAdvancedFilters && (
        <Card>
          <CardContent className="p-3 grid grid-cols-2 gap-2">
            <Input
              value={advancedCategory}
              onChange={(e) => setAdvancedCategory(e.target.value || "all")}
              placeholder="Categoria (ou all)"
            />
            <div className="flex gap-1">
              {[
                { key: "all", label: "Tudo" },
                { key: "receitas", label: "Receitas" },
                { key: "despesas", label: "Despesas" },
              ].map((scope) => (
                <button
                  key={scope.key}
                  onClick={() => setAdvancedScope(scope.key as typeof advancedScope)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[10px]",
                    advancedScope === scope.key ? "border-primary text-primary" : "border-border text-muted-foreground",
                  )}
                >
                  {scope.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {featureSettings.enableDashboardInsights && (
        <Card>
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Insights</p>
            <p className="text-sm">Maior gasto do mês: {stats.variaveis.concat(stats.fixasDespesa).length > 0 ? formatCurrency(Math.max(...stats.variaveis.concat(stats.fixasDespesa).map((l) => l.valor))) : formatCurrency(0)}</p>
            <p className="text-xs text-muted-foreground">Entradas: {stats.fixasReceita.length + stats.variaveisReceita.length} · Saídas: {stats.fixasDespesa.length + stats.variaveis.length + stats.cartaoLanc.length}</p>
          </CardContent>
        </Card>
      )}

      {featureSettings.enableCashflowHighlights && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Fluxo de Caixa</p>
            <p className={cn("text-sm font-medium", saldo >= 0 ? "text-success" : "text-destructive")}>
              Projeção do mês: {formatCurrency(saldo)}
            </p>
          </CardContent>
        </Card>
      )}

      {(featureSettings.enableImportCenter || featureSettings.enableExperimentalFeatures) && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Central de Importação</p>
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {featureSettings.enableCsvImport && <span className="rounded-full border px-2 py-1">CSV</span>}
              {featureSettings.enableOfxImport && <span className="rounded-full border px-2 py-1">OFX</span>}
              {featureSettings.enableImportReconciliation && <span className="rounded-full border px-2 py-1">Conciliação</span>}
              {featureSettings.enableExperimentalFeatures && <span className="rounded-full border px-2 py-1">Experimental</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {featureSettings.enableBatchActionsInicio && (variaveisView.length > 0 || orfaosView.length > 0) && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Ações em lote</p>
            <div className="flex gap-2">
              {variaveisView.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ids = variaveisView.map((l) => l.id);
                    const { error } = await supabase.from("lancamentos").delete().in("id", ids);
                    if (!error) {
                      qc.invalidateQueries({ queryKey: ["lancamentos"] });
                      toast({ title: `${ids.length} lançamento(s) variável(is) removido(s)!` });
                    }
                  }}
                >
                  Excluir variáveis filtradas
                </Button>
              )}
              {orfaosView.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ids = orfaosView.map((l) => l.id);
                    const { error } = await supabase.from("lancamentos").delete().in("id", ids);
                    if (!error) {
                      qc.invalidateQueries({ queryKey: ["lancamentos"] });
                      toast({ title: `${ids.length} órfão(s) removido(s)!` });
                    }
                  }}
                >
                  Excluir órfãos filtrados
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entradas Fixas */}
      {fixasReceitaView.length > 0 && (
        <Section title="Entradas Fixas" icon={<TrendingUp className="h-4 w-4 text-success" />}>
          {fixasReceitaView.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} />
          ))}
        </Section>
      )}

      {/* Entradas Variaveis */}
      {variaveisReceitaView.length > 0 && (
        <Section title="Entradas" icon={<TrendingUp className="h-4 w-4 text-success" />}>
          {variaveisReceitaView.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} />
          ))}
        </Section>
      )}

      {/* Saídas Fixas */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saídas Fixas</h3>
        </div>
        {fixasDespesaView.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma</p>
        )}
        {fixasDespesaView.map((l) => (
          <MiniLancamentoRow
            key={l.id}
            item={l}
            isPaid={!!fixedExpensePaidMap[l.id]}
            onTogglePaid={() => toggleFixedExpensePaid(l.id)}
            onClick={() => openEdit(l)}
            onReceiptClick={() => { setReceiptLancamento(l); setShowReceiptModal(true); }}
          />
        ))}
        {fixasDespesaView.length > 0 && (
          <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-center">
            <p className="text-xs font-semibold text-destructive">
              Total: {formatCurrency(fixasDespesaView.reduce((s, l) => s + l.valor, 0))}
            </p>
          </div>
        )}
      </div>

      {/* Cartões resumido (abaixo de Saídas Fixas) */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cartões</h3>
        </div>
        {cartaoGroups.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum cartão</p>
        )}
        {lancamentosLoading && cartaoGroups.length === 0 && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}
        {cartaoGroups.map(({ cartao, total, pago }) => (
          <button
            key={cartao.id}
            onClick={() => setExpandedCard(expandedCard === cartao.id ? null : cartao.id)}
            className="w-full rounded-lg bg-card border border-border p-2 text-left hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <BrandLogo
                store={cartao.nome}
                initialUrl={cartao.logo_url}
                merchantId={cartao.merchant_id}
                size={20}
                fallbackIcon={<CreditCard className="h-3 w-3 text-primary" />}
                fallbackBg="hsl(var(--primary) / 0.1)"
              />
              <p className="text-xs font-medium truncate">{cartao.nome}</p>
            </div>
            <p className="text-sm font-semibold">{formatCurrency(total)}</p>
            <div className="flex items-center justify-between mt-1">
              <span className={cn("text-[10px]", pago ? "text-success" : "text-warning")}>
                {pago ? "✓ Pago" : "Pendente"}
              </span>
              {!pago && total > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Fechar fatura: criar fatura pendente (mes é 0-based, faturas usam 1-based)
                    const mesFatura = mes + 1;
                    const anoFatura = ano;
                    supabase.from("faturas").insert({
                      usuario_id: user!.id,
                      cartao_id: cartao.id,
                      mes: mesFatura,
                      ano: anoFatura,
                      valor_total: total,
                      status: "pendente"
                    }).then(({ error }) => {
                      if (error) {
                        toast({ title: "Erro ao fechar fatura", description: error.message, variant: "destructive" });
                      } else {
                        qc.invalidateQueries({ queryKey: ["faturas"] });
                        toast({ title: "Fatura fechada!" });
                      }
                    });
                  }}
                  className="text-[10px] text-primary hover:underline"
                  title="Fechar fatura pendente"
                >
                  Fechar
                </button>
              )}
              {expandedCard === cartao.id ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Fatura expandida - compras do cartão selecionado */}
      {expandedCard && (() => {
        const group = cartaoGroups.find((g) => g.cartao.id === expandedCard);
        if (!group) return null;
        return (
          <Card className="border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Fecha dia {group.cartao.fechamento}</p>
                </div>
                <div className="flex flex-col items-center">
                  <BrandLogo
                    store={group.cartao.nome}
                    initialUrl={group.cartao.logo_url}
                    merchantId={group.cartao.merchant_id}
                    size={40}
                    fallbackIcon={<CreditCard className="h-5 w-5 text-primary" />}
                    fallbackBg="hsl(var(--primary) / 0.1)"
                  />
                  <p className="text-sm font-semibold text-center leading-tight mt-1">{group.cartao.nome}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-lg font-bold">{formatCurrency(group.total)}</p>
                  <p className="text-xs text-muted-foreground">Vence dia {group.cartao.vencimento}</p>
                  <span className={cn("text-[10px]", group.pago ? "text-success" : "text-warning")}>
                    {group.pago ? "✓ Pago" : "Pendente"}
                  </span>
                </div>
              </div>

              {/* Lista de compras */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Compras ({group.compras.length})</p>
                {group.compras.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma compra neste mês.</p>
                )}
                {group.compras.map((l) => {
                  const cat = getCategoriaInfo(l.categoria);
                  const Icon = cat.icon;
                  const hasReceipt = !!getDbComprovanteUrl(l) || !!getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${l.id}`);
                  const displayDate = l.data_compra ?? l.data;
                  const formattedDate = new Date(displayDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                  return (
                    <div key={l.id} className="flex items-center gap-2 rounded-md bg-secondary p-2">
                      {/* Left: store logo + description */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {l.loja ? (
                          <BrandLogo store={l.loja} initialUrl={l.merchant_logo_url} merchantId={l.merchant_id} fallbackIcon={<Icon className="h-3.5 w-3.5" style={{ color: cat.color }} />} fallbackBg={cat.color + "20"} />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: cat.color }} />
                          </div>
                        )}
                        <div className="min-w-0">
                          {l.loja && <p className="text-[10px] text-muted-foreground truncate">{l.loja}</p>}
                          <p className="text-xs font-medium truncate">
                            <span className="text-muted-foreground font-normal mr-1">{formattedDate}</span>
                            {l.descricao}
                          </p>
                          {l.parcela_atual && l.parcelas ? (
                            <p className="text-[10px] text-muted-foreground">{l.parcela_atual}/{l.parcelas}</p>
                          ) : null}
                        </div>
                      </div>
                      {/* Right: value + actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <p className="text-xs font-semibold">{formatCurrency(l.valor)}</p>
                        <button
                          onClick={() => { setReceiptLancamento(l); setShowReceiptModal(true); }}
                          className={cn("p-1 hover:text-foreground", hasReceipt ? "text-primary" : "text-muted-foreground")}
                          title={hasReceipt ? "Visualizar comprovante" : "Anexar comprovante"}
                        >
                          <Paperclip className="h-3 w-3" />
                        </button>
                        <button onClick={() => openEdit(l)} className="p-1 text-muted-foreground hover:text-foreground">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteLancamento.mutate(l)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ações da fatura */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setEditItem(null);
                    setShowEdit(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Compra
                </Button>
                {group.pago ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => togglePago.mutate({ cartaoId: group.cartao.id, pago: true })}
                  >
                    <Undo2 className="h-3 w-3 mr-1" /> Desfazer Pgto
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => togglePago.mutate({ cartaoId: group.cartao.id, pago: false })}
                  >
                    <Check className="h-3 w-3 mr-1" /> Pagar Fatura
                  </Button>
                )}
              </div>

              {/* Comprovante do pagamento da fatura (DB when available, local fallback otherwise) */}
              {(() => {
                const dbPath = getDbComprovanteUrl(group.fatura);
                const localKey = group.fatura
                  ? `${FATURA_RECEIPT_KEY}${group.fatura.id}`
                  : `${FATURA_RECEIPT_KEY}${group.cartao.id}:${mes + 1}:${ano}`;
                const path = dbPath ?? getLocalReceipt(localKey);
                if (!path) return null;

                return (
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">📸 Comprovante do Pagamento</p>
                    <ReceiptViewer filePath={path} fileName="Comprovante" />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })()}

      {/* Despesas fixas no cartão (visualização) */}
      {featureSettings.showFixedCardExpensesSection && fixasCartaoGroups.length > 0 && (
        <Section title="Despesas Fixas no Cartão" icon={<CreditCard className="h-4 w-4 text-destructive" />}>
          {fixasCartaoGroups.map((group) => (
            <Card key={group.cartao.id} className="border-border/70">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <BrandLogo
                      store={group.cartao.nome}
                      initialUrl={group.cartao.logo_url}
                      merchantId={group.cartao.merchant_id}
                      size={22}
                      fallbackIcon={<CreditCard className="h-3.5 w-3.5 text-primary" />}
                      fallbackBg="hsl(var(--primary) / 0.1)"
                    />
                    <p className="text-xs font-semibold truncate">{group.cartao.nome}</p>
                  </div>
                  <span className={cn("text-[10px] font-medium", group.pago ? "text-success" : "text-destructive")}> 
                    {group.pago ? "Pago" : "Pendente"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.itens.map((item) => (
                    <FixedCardExpenseRow
                      key={item.id}
                      item={item}
                      paid={group.pago}
                      onEdit={() => openEdit(item)}
                      onDelete={() => deleteLancamento.mutate(item)}
                      onReceiptClick={() => { setReceiptLancamento(item); setShowReceiptModal(true); }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </Section>
      )}

      {/* Despesas órfãs — card expenses with no valid card (ghost expenses) */}
      {featureSettings.notifyOrphanTransactions && orfaosView.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-destructive">⚠️</span>
            <p className="text-xs font-semibold text-destructive">Lançamentos sem cartão associado</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Estes lançamentos estão afetando o saldo mas não estão vinculados a nenhum cartão. Toque em um para editar ou excluir.
          </p>
          <div className="space-y-2">
            {orfaosView.map((l) => (
              <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} onReceiptClick={() => { setReceiptLancamento(l); setShowReceiptModal(true); }} />
            ))}
          </div>
        </div>
      )}

      {/* Variáveis */}
      {variaveisView.length > 0 && (
        <Section title="Variáveis" icon={<ShoppingBag className="h-4 w-4 text-warning" />}>
          {variaveisView.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} onReceiptClick={() => { setReceiptLancamento(l); setShowReceiptModal(true); }} />
          ))}
        </Section>
      )}

      {lancamentos.length === 0 && cartaoGroups.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>Nenhum lançamento neste mês.</p>
          <p className="text-sm">Toque no + para adicionar.</p>
        </div>
      )}

      <NovoLancamentoModal
        open={showEdit}
        onOpenChange={setShowEdit}
        editItem={editItem}
        sharedFile={sharedFile}
        onSharedFileConsumed={clearSharedFile}
      />

      {/* Modal Comprovante Despesa Fixa */}
      <ReceiptDespesaFixaModal
        open={showReceiptModal}
        onOpenChange={(v) => { setShowReceiptModal(v); if (!v) setReceiptLancamento(null); }}
        lancamento={receiptLancamento}
        onSaved={() => qc.invalidateQueries({ queryKey: ["lancamentos"] })}
        receiptRefreshTick={receiptRefreshTick}
        onReceiptSaved={() => setReceiptRefreshTick((v) => v + 1)}
      />

      {/* Modal Pagar Fatura */}
      <PagarFaturaModal
        open={showPagarModal}
        onOpenChange={setShowPagarModal}
        cartaoId={pagarCartaoId}
        userId={user?.id || ""}
        mes={mes + 1}
        ano={ano}
        valorTotal={cartaoGroups.find((g) => g.cartao.id === pagarCartaoId)?.total ?? 0}
        faturaExistente={faturas.find((f) => f.cartao_id === pagarCartaoId) ?? null}
        receiptRefreshTick={receiptRefreshTick}
        onReceiptSaved={() => setReceiptRefreshTick((v) => v + 1)}
      />

      <Onboarding
        open={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem("sunshine-budget-onboarding", "true");
        }}
      />

      {/* Confirmation dialog for installment group deletion */}
    </div>
  );
};

/* ---- Sub-components ---- */

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const LancamentoRow = ({ item, onClick, onReceiptClick }: { item: Tables<"lancamentos">; onClick: () => void; onReceiptClick?: () => void }) => {
  const cat = getCategoriaInfo(item.categoria);
  const Icon = cat.icon;
  const rawTipo = (item.tipo ?? "").toString().trim().toLowerCase();
  const isReceita = rawTipo === "receita" || rawTipo === "entrada" || (rawTipo !== "despesa" && rawTipo !== "saida" && item.valor < 0);
  const hasReceipt = !!getDbComprovanteUrl(item) || !!getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${item.id}`);
  return (
    <div className="flex w-full items-center gap-2 rounded-lg bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
      <button onClick={onClick} className="flex flex-1 items-center gap-3 p-3 text-left min-w-0">
        {item.loja ? (
          <BrandLogo store={item.loja} initialUrl={item.merchant_logo_url} size={36} fallbackIcon={<Icon className="h-4 w-4" style={{ color: cat.color }} />} fallbackBg={cat.color + "20"} />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
            <Icon className="h-4 w-4" style={{ color: cat.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.descricao}</p>
          <p className="text-xs text-muted-foreground">{cat.label}{item.loja ? ` · ${item.loja}` : ""}</p>
        </div>
        <p className={cn("text-sm font-semibold flex-shrink-0", isReceita ? "text-success" : "text-foreground")}> 
          {isReceita ? "+" : "-"}{formatCurrency(Math.abs(item.valor))}
        </p>
      </button>
      {onReceiptClick && (
        <button
          onClick={onReceiptClick}
          className={cn("p-2 flex-shrink-0 hover:text-foreground", hasReceipt ? "text-primary" : "text-muted-foreground")}
          title={hasReceipt ? "Visualizar comprovante" : "Anexar comprovante"}
        >
          <Paperclip className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const MiniLancamentoRow = ({
  item,
  isPaid,
  onTogglePaid,
  onClick,
  onReceiptClick,
}: {
  item: Tables<"lancamentos">;
  isPaid?: boolean;
  onTogglePaid?: () => void;
  onClick: () => void;
  onReceiptClick?: () => void;
}) => {
  const cat = getCategoriaInfo(item.categoria);
  const Icon = cat.icon;
  const hasReceipt = !!getDbComprovanteUrl(item) || !!getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${item.id}`);
  return (
    <div className={cn(
      "flex w-full items-center gap-2 rounded-lg p-2 border hover:shadow-sm transition-shadow",
      isPaid ? "bg-success/10 border-success/40" : "bg-card border-border",
    )}>
      <button onClick={onClick} className="flex flex-1 items-center gap-2 text-left min-w-0">
        {item.loja ? (
          <BrandLogo
            store={item.loja}
            initialUrl={item.merchant_logo_url}
            merchantId={item.merchant_id}
            size={24}
            fallbackIcon={<Icon className="h-3 w-3" style={{ color: cat.color }} />}
            fallbackBg={cat.color + "20"}
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
            <Icon className="h-3 w-3" style={{ color: cat.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{item.descricao}</p>
        </div>
        <p className="text-xs font-semibold">{formatCurrency(item.valor)}</p>
      </button>
      {onTogglePaid && (
        <button
          onClick={onTogglePaid}
          className={cn(
            "rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors",
            isPaid
              ? "border-success/40 bg-success/20 text-success"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground",
          )}
          title={isPaid ? "Marcar como pendente" : "Marcar como pago"}
        >
          {isPaid ? "Pago" : "Pagar"}
        </button>
      )}
      {onReceiptClick && (
        <button
          onClick={onReceiptClick}
          className={cn("p-1 flex-shrink-0 hover:text-foreground", hasReceipt ? "text-primary" : "text-muted-foreground")}
          title={hasReceipt ? "Visualizar comprovante" : "Anexar comprovante"}
        >
          <Paperclip className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

const FixedCardExpenseRow = ({
  item,
  paid,
  onEdit,
  onDelete,
  onReceiptClick,
}: {
  item: Tables<"lancamentos">;
  paid: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReceiptClick: () => void;
}) => {
  const cat = getCategoriaInfo(item.categoria);
  const Icon = cat.icon;
  const hasReceipt = !!getDbComprovanteUrl(item) || !!getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${item.id}`);

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md border p-2",
      paid ? "bg-success/10 border-success/40" : "bg-destructive/10 border-destructive/40",
    )}>
      <button onClick={onEdit} className="flex flex-1 items-center gap-2 text-left min-w-0">
        {item.loja ? (
          <BrandLogo
            store={item.loja}
            initialUrl={item.merchant_logo_url}
            merchantId={item.merchant_id}
            size={24}
            fallbackIcon={<Icon className="h-3 w-3" style={{ color: cat.color }} />}
            fallbackBg={cat.color + "20"}
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-md flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
            <Icon className="h-3 w-3" style={{ color: cat.color }} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{item.descricao}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.loja || cat.label}</p>
        </div>
      </button>

      <p className={cn("text-xs font-semibold", paid ? "text-success" : "text-destructive")}>
        {formatCurrency(item.valor)}
      </p>
      <button
        onClick={onReceiptClick}
        className={cn("p-1 hover:text-foreground", hasReceipt ? "text-primary" : "text-muted-foreground")}
        title={hasReceipt ? "Visualizar comprovante" : "Anexar comprovante"}
      >
        <Paperclip className="h-3 w-3" />
      </button>
      <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground" title="Editar">
        <Edit2 className="h-3 w-3" />
      </button>
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" title="Excluir">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};

/* ---- Comprovante Despesa Fixa Modal ---- */

interface ReceiptDespesaFixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamento: Tables<"lancamentos"> | null;
  onSaved: () => void;
  receiptRefreshTick: number;
  onReceiptSaved: () => void;
}

const ReceiptDespesaFixaModal = ({
  open,
  onOpenChange,
  lancamento,
  onSaved,
  receiptRefreshTick,
  onReceiptSaved,
}: ReceiptDespesaFixaModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  useEffect(() => {
    if (lancamento) {
      const dbPath = getDbComprovanteUrl(lancamento);
      const localPath = getLocalReceipt(`${LANCAMENTO_RECEIPT_KEY}${lancamento.id}`);
      const path = dbPath ?? localPath ?? '';
      setReceiptPath(path);
      setReceiptFileName(path ? 'Comprovante' : '');
    } else {
      setReceiptPath('');
      setReceiptFileName('');
    }
  }, [lancamento, open, receiptRefreshTick]);

  const handleSave = async () => {
    if (!lancamento) return;
    setLoading(true);
    try {
      const localKey = `${LANCAMENTO_RECEIPT_KEY}${lancamento.id}`;
      const nextVal = receiptPath || null;
      setLocalReceipt(localKey, nextVal);

      // Try DB persistence across likely attachment column names.
      let dbSaved = false;
      let lastError: unknown = null;
      for (const col of RECEIPT_COLUMNS) {
        const { error } = await supabase.from("lancamentos")
          .update({ [col]: nextVal } as never)
          .eq("id", lancamento.id);
        if (!error) {
          dbSaved = true;
          break;
        }
        if (isUnknownColumnError(error, col)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      if (!dbSaved) {
        if (lastError) {
          toast({ title: "Comprovante salvo localmente neste dispositivo." });
        }
      } else {
        toast({ title: "Comprovante salvo!" });
      }

      onReceiptSaved();
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>📎 Comprovante — {lancamento?.descricao}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-sm text-muted-foreground">Valor</p>
            <p className="text-2xl font-bold">{formatCurrency(lancamento?.valor ?? 0)}</p>
          </div>
          {receiptPath ? (
            <ReceiptViewer
              filePath={receiptPath}
              fileName={receiptFileName || 'Comprovante'}
              onRemove={() => { setReceiptPath(''); setReceiptFileName(''); }}
            />
          ) : (
            <ReceiptUploadButton
              onUploadSuccess={(path, fileName) => {
                setReceiptPath(path);
                setReceiptFileName(fileName);
              }}
            />
          )}
          <Button className="w-full" onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ---- Pagar Fatura Modal ---- */

interface PagarFaturaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartaoId: string | null;
  userId: string;
  mes: number;
  ano: number;
  valorTotal: number;
  faturaExistente: Tables<"faturas"> | null;
  receiptRefreshTick: number;
  onReceiptSaved: () => void;
}

const PagarFaturaModal = ({
  open,
  onOpenChange,
  cartaoId,
  userId,
  mes,
  ano,
  valorTotal,
  faturaExistente,
  receiptRefreshTick,
  onReceiptSaved,
}: PagarFaturaModalProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [valorPago, setValorPago] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // Reset/pre-fill receipt state whenever the modal opens or the existing invoice changes
  useEffect(() => {
    if (open) {
      const key = faturaExistente
        ? `${FATURA_RECEIPT_KEY}${faturaExistente.id}`
        : `${FATURA_RECEIPT_KEY}${cartaoId ?? "none"}:${mes}:${ano}`;
      const dbPath = getDbComprovanteUrl(faturaExistente);
      const localPath = getLocalReceipt(key);
      const path = dbPath ?? localPath ?? '';
      setReceiptPath(path);
      setReceiptFileName(path ? 'Comprovante' : '');
    }
  }, [open, faturaExistente, cartaoId, mes, ano, receiptRefreshTick]);

  // Reset the payment amount field each time the modal opens fresh
  useEffect(() => {
    if (open) setValorPago("");
  }, [open]);

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartaoId) return;
    setLoading(true);
    try {
      const valor = parseFloat(valorPago) || valorTotal;
      const nextReceipt = receiptPath || null;
      const localKey = faturaExistente
        ? `${FATURA_RECEIPT_KEY}${faturaExistente.id}`
        : `${FATURA_RECEIPT_KEY}${cartaoId}:${mes}:${ano}`;
      setLocalReceipt(localKey, nextReceipt);

      if (faturaExistente) {
        // Base status update always required.
        const { error: baseError } = await supabase.from("faturas")
          .update({ status: "pago", valor_total: valor })
          .eq("id", faturaExistente.id);
        if (baseError) throw baseError;

        // Optional receipt persistence by probing likely column names.
        for (const col of RECEIPT_COLUMNS) {
          const { error } = await supabase.from("faturas")
            .update({ [col]: nextReceipt } as never)
            .eq("id", faturaExistente.id);
          if (!error) break;
          if (isUnknownColumnError(error, col)) continue;
          throw error;
        }
      } else {
        const basePayload = {
          usuario_id: userId,
          cartao_id: cartaoId,
          mes,
          ano,
          status: "pago",
          valor_total: valor,
        };

        // First try insert with a receipt column; fallback to base payload.
        let inserted = false;
        for (const col of RECEIPT_COLUMNS) {
          const { error } = await supabase.from("faturas").insert({
            ...basePayload,
            [col]: nextReceipt,
          } as never);
          if (!error) {
            inserted = true;
            break;
          }
          if (isUnknownColumnError(error, col)) continue;
          throw error;
        }

        if (!inserted) {
          const { error } = await supabase.from("faturas").insert(basePayload);
          if (error) throw error;
        }
      }
      qc.invalidateQueries({ queryKey: ["faturas"] });
      onReceiptSaved();
      toast({ title: "Fatura paga!" });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar Fatura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePagar} className="space-y-4">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <p className="text-sm text-muted-foreground">Valor da fatura</p>
            <p className="text-2xl font-bold">{formatCurrency(valorTotal)}</p>
          </div>
          <div className="space-y-2">
            <Label>Valor efetivo pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder={String(valorTotal)}
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Deixe em branco para usar o valor da fatura</p>
          </div>
                     {/* SEÇÃO DE COMPROVANTE DO PAGAMENTO */}
           <div className="border-t pt-4">
             <h4 className="font-semibold text-sm mb-3">📸 Comprovante do Pagamento</h4>
             {receiptPath ? (
               <ReceiptViewer
                 filePath={receiptPath}
                 fileName={receiptFileName}
                 onRemove={() => { setReceiptPath(''); setReceiptFileName(''); }}
               />
             ) : (
               <ReceiptUploadButton
                 onUploadSuccess={(path, fileName) => {
                   setReceiptPath(path);
                   setReceiptFileName(fileName);
                 }}
               />
             )}
           </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processando..." : "Confirmar Pagamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
