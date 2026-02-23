import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MonthSelector from "@/components/MonthSelector";
import NovoLancamentoModal from "@/components/NovoLancamentoModal";
import { formatCurrency } from "@/lib/formatters";
import { getCategoriaInfo } from "@/lib/categories";
import { TrendingUp, TrendingDown, CreditCard, ShoppingBag } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const Dashboard = () => {
  const { user } = useAuth();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());
  const [editItem, setEditItem] = useState<Tables<"lancamentos"> | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const startDate = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const endDate = mes === 11
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mes + 2).padStart(2, "0")}-01`;

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["lancamentos", user?.id, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("*")
        .eq("user_id", user!.id)
        .gte("data", startDate)
        .lt("data", endDate)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: faturas = [] } = useQuery({
    queryKey: ["faturas", user?.id, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturas").select("*").eq("user_id", user!.id)
        .eq("mes", mes + 1).eq("ano", ano);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    const receitas = lancamentos.filter((l) => l.tipo === "receita");
    const despesas = lancamentos.filter((l) => l.tipo === "despesa");
    const totalReceita = receitas.reduce((s, l) => s + l.valor, 0);
    const totalDespesa = despesas.reduce((s, l) => s + l.valor, 0);
    const fixasReceita = receitas.filter((l) => l.fixo);
    const fixasDespesa = despesas.filter((l) => l.fixo && l.metodo === "avista");
    const cartaoLanc = despesas.filter((l) => l.metodo === "cartao");
    const variaveis = despesas.filter((l) => !l.fixo && l.metodo === "avista");

    return { totalReceita, totalDespesa, fixasReceita, fixasDespesa, cartaoLanc, variaveis };
  }, [lancamentos]);

  const saldo = stats.totalReceita - stats.totalDespesa;
  const pctGasto = stats.totalReceita > 0
    ? Math.min(100, Math.round((stats.totalDespesa / stats.totalReceita) * 100))
    : 0;

  const openEdit = (item: Tables<"lancamentos">) => {
    setEditItem(item);
    setShowEdit(true);
  };

  // Group card expenses by card
  const cartaoGroups = useMemo(() => {
    const groups = new Map<string, { cartao: Tables<"cartoes">; total: number; pago: boolean }>();
    stats.cartaoLanc.forEach((l) => {
      if (!l.cartao_id) return;
      const existing = groups.get(l.cartao_id);
      if (existing) {
        existing.total += l.valor;
      } else {
        const cartao = cartoes.find((c) => c.id === l.cartao_id);
        if (cartao) {
          const fatura = faturas.find((f) => f.cartao_id === l.cartao_id);
          groups.set(l.cartao_id, { cartao, total: l.valor, pago: fatura?.pago ?? false });
        }
      }
    });
    return Array.from(groups.values());
  }, [stats.cartaoLanc, cartoes, faturas]);

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4">
      <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />

      {/* Saldo */}
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <p className={`text-3xl font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(saldo)}
          </p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{pctGasto}% gasto</span>
            <span className="text-muted-foreground">{formatCurrency(stats.totalDespesa)} / {formatCurrency(stats.totalReceita)}</span>
          </div>
          <Progress value={pctGasto} className="mt-2 h-2" />
        </CardContent>
      </Card>

      {/* Entradas Fixas */}
      {stats.fixasReceita.length > 0 && (
        <Section title="Entradas Fixas" icon={<TrendingUp className="h-4 w-4 text-success" />}>
          {stats.fixasReceita.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} />
          ))}
        </Section>
      )}

      {/* Saídas Fixas */}
      {stats.fixasDespesa.length > 0 && (
        <Section title="Saídas Fixas" icon={<TrendingDown className="h-4 w-4 text-destructive" />}>
          {stats.fixasDespesa.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} />
          ))}
        </Section>
      )}

      {/* Cartões */}
      {cartaoGroups.length > 0 && (
        <Section title="Cartões / Extras" icon={<CreditCard className="h-4 w-4 text-primary" />}>
          {cartaoGroups.map(({ cartao, total, pago }) => (
            <div key={cartao.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
              <div>
                <p className="text-sm font-medium">{cartao.instituicao} •••• {cartao.final_cartao}</p>
                <p className="text-xs text-muted-foreground">Venc. dia {cartao.dia_vencimento}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatCurrency(total)}</p>
                <span className={`text-xs ${pago ? "text-success" : "text-warning"}`}>
                  {pago ? "Pago" : "Pendente"}
                </span>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Variáveis */}
      {stats.variaveis.length > 0 && (
        <Section title="Variáveis" icon={<ShoppingBag className="h-4 w-4 text-warning" />}>
          {stats.variaveis.map((l) => (
            <LancamentoRow key={l.id} item={l} onClick={() => openEdit(l)} />
          ))}
        </Section>
      )}

      {lancamentos.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>Nenhum lançamento neste mês.</p>
          <p className="text-sm">Toque no + para adicionar.</p>
        </div>
      )}

      <NovoLancamentoModal open={showEdit} onOpenChange={setShowEdit} editItem={editItem} />
    </div>
  );
};

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const LancamentoRow = ({ item, onClick }: { item: Tables<"lancamentos">; onClick: () => void }) => {
  const cat = getCategoriaInfo(item.categoria);
  const Icon = cat.icon;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg bg-card p-3 text-left shadow-sm hover:shadow-md transition-shadow border border-border">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: cat.color + "20" }}>
        <Icon className="h-4 w-4" style={{ color: cat.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.descricao}</p>
        <p className="text-xs text-muted-foreground">{cat.label}{item.loja ? ` · ${item.loja}` : ""}</p>
      </div>
      <p className={`text-sm font-semibold ${item.tipo === "receita" ? "text-success" : "text-foreground"}`}>
        {item.tipo === "receita" ? "+" : "-"}{formatCurrency(item.valor)}
      </p>
    </button>
  );
};

export default Dashboard;
