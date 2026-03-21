import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, MESES } from "@/lib/formatters";
import { getCategoriaInfo } from "@/lib/categories";
import { readSettingsFromStorage } from "@/lib/userSettings";
import {
  ChatMessage,
  ChatSession,
  createSession,
  getSessions,
  saveSessions,
  getPreviousSession,
  formatSessionSummary,
} from "@/lib/chatSession";

/* ─── helpers ─── */
const newMsg = (
  role: ChatMessage["role"],
  content: string
): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: Date.now(),
});

const WELCOME =
  'Olá! 👋 Sou seu assistente financeiro com foco em análise do seu histórico. Posso te ajudar com **gastos**, **faturas por mês**, **cartões**, **transações**, **objetivos** e também te **ensinar todas as configurações do app**.\n\nExemplos: "fatura de março", "como configurar notificações", "me explique as configurações de segurança" ou "última sessão".';

const BOTTOM_NAV_HEIGHT = "5rem";
const SESSION_REUSE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/* ─── keyword matchers ─── */
const is = (text: string, ...patterns: RegExp[]) =>
  patterns.some((p) => p.test(text));

const matchLastSession = (t: string) =>
  is(t, /[uú]ltim[ao]\s+sess[aã]o/i, /[uú]ltim[ao]\s+se[çc][aã]o/i);

const matchGastos = (t: string) =>
  is(t, /gast[oa]s?/i, /despesa/i, /quanto\s+gastei/i, /total\s+do\s+m[eê]s/i);

const matchTransacoes = (t: string) =>
  is(
    t,
    /transa[çc][oõ]es?/i,
    /lan[çc]amento/i,
    /compras?/i,
    /[uú]ltim[ao]s?\s+\d*\s*(gast|compra|lan[çc])/i
  );

const matchCartoes = (t: string) =>
  is(t, /cart[aã]o|cart[oõ]es/i, /fatura/i, /limite/i);

const matchFaturas = (t: string) =>
  is(t, /fatura/i, /faturas/i, /vencimento/i, /cart[aã]o.*m[eê]s/i, /m[eê]s\s*\d{1,2}/i);

const matchObjetivos = (t: string) =>
  is(t, /objetivo/i, /meta/i, /planejamento/i);

const matchConfiguracoes = (t: string) =>
  is(
    t,
    /configura[cç][aã]o/i,
    /configura[cç][oõ]es/i,
    /ajust(es|e)/i,
    /perfil/i,
    /como configurar/i,
    /o que .*configura[cç][aã]o/i,
  );

const matchAjuda = (t: string) =>
  is(t, /ajuda/i, /help/i, /o que (você|vc) (faz|sabe)/i, /comandos?/i);

const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTH_BY_NAME: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

const parseMonthFromText = (text: string, now: Date): { mes: number; ano: number } => {
  const lower = text.toLowerCase();

  if (/pr[oó]ximo\s+m[eê]s/.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { mes: d.getMonth(), ano: d.getFullYear() };
  }

  if (/m[eê]s\s+passado|[uú]ltimo\s+m[eê]s/.test(lower)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { mes: d.getMonth(), ano: d.getFullYear() };
  }

  const explicitYear = lower.match(/(?:ano\s*)?(20\d{2})/);
  const parsedYear = explicitYear ? Number(explicitYear[1]) : now.getFullYear();

  const explicitNumberMonth = lower.match(/m[eê]s\s*(\d{1,2})/);
  if (explicitNumberMonth) {
    const m = Number(explicitNumberMonth[1]);
    if (m >= 1 && m <= 12) return { mes: m - 1, ano: parsedYear };
  }

  for (const [monthName, monthIndex] of Object.entries(MONTH_BY_NAME)) {
    if (lower.includes(monthName)) {
      return { mes: monthIndex, ano: parsedYear };
    }
  }

  return { mes: now.getMonth(), ano: now.getFullYear() };
};

const SETTINGS_GUIDE =
  "🧭 **Guia completo de configurações**\n\n" +
  "**1) Lançamentos e automações**\n" +
  "Auto-categorizar: preenche categoria automaticamente por histórico.\n" +
  "Sugerir cartão: indica cartão provável ao lançar compra.\n" +
  "Prévia da fatura: mostra em qual fatura a compra vai cair.\n" +
  "Templates: salva modelos de lançamentos repetidos.\n" +
  "Sugestões preditivas: recomenda valores/categorias com base no uso.\n" +
  "Split de transação: divide um lançamento em várias categorias.\n" +
  "Edição de recorrência: decide se altera este/próximos/todos.\n" +
  "Filtros avançados: habilita filtros detalhados no histórico.\n\n" +
  "**2) Aba Início (Dashboard)**\n" +
  "Busca: pesquisar por descrição/loja direto no início.\n" +
  "Filtros rápidos: atalhos de visualização (com/sem anexo, fixas etc.).\n" +
  "Ações em lote: excluir/ajustar vários lançamentos de uma vez.\n" +
  "Insights: cartões de resumo e alertas de comportamento.\n" +
  "Fluxo de caixa: projeções de entradas/saídas.\n" +
  "Despesas fixas no cartão: seção dedicada no dashboard.\n" +
  "Excluir fixas do cartão dos totais: útil para evitar dupla contagem no saldo.\n" +
  "Visualização compacta: cartões mais enxutos para quem tem muitos bancos.\n\n" +
  "**3) Validação e comprovantes**\n" +
  "Bloquear duplicidades: evita lançamento repetido por engano.\n" +
  "Desfazer ações: permite recuperar exclusões/edições rápidas.\n" +
  "Exigir comprovante acima de valor: aplica regra por limite mínimo (R$).\n\n" +
  "**4) Notificações**\n" +
  "Fechamento e vencimento de fatura: lembra datas críticas.\n" +
  "Anomalias: alerta gastos fora do padrão.\n" +
  "Comprovante faltante: lembra anexos pendentes.\n" +
  "Lançamentos órfãos: detecta despesas sem cartão associado.\n" +
  "Assinaturas: aponta cobranças recorrentes prováveis.\n" +
  "Importações pendentes: avisa itens que precisam revisão.\n\n" +
  "**5) Importação e recursos futuros**\n" +
  "Central de importação + conciliação automática: preparação para fluxo bancário.\n" +
  "CSV/OFX: habilita formatos de extrato.\n" +
  "Recursos experimentais: novas funções em teste (use com cautela).\n\n" +
  "**6) Objetivos**\n" +
  "Busca, insights, projeção mensal, confirmação ao excluir, destaque de meta concluída, ações rápidas, cálculo automático e linha do tempo.\n\n" +
  "**7) Perfil e Segurança**\n" +
  "Bloqueio do app, senha para contas Google, biometria, seções de segurança/WhatsApp, card de serviços conectados e dicas de perfil.\n\n" +
  "✅ **Como configurar (recomendado)**\n" +
  "Perfil conservador: bloquear duplicidade, exigir comprovante, lembretes de vencimento e bloqueio do app.\n" +
  "Perfil prático: auto-categorizar, sugerir cartão, filtros rápidos e busca.\n" +
  "Perfil avançado: insights, fluxo de caixa, filtros avançados e conciliação/importação.";

/* ─── component ─── */
const Chat = () => {
  const { user } = useAuth();
  const userId = user!.id;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const userSettings = useMemo(() => readSettingsFromStorage(userId), [userId]);

  // Initialize session scoped to the current user
  const [session, setSession] = useState<ChatSession>(() => {
    const sessions = getSessions(userId);
    const last = sessions[sessions.length - 1];
    // Reuse a session started < 2 h ago for the same user
    if (last && Date.now() - last.startedAt < SESSION_REUSE_THRESHOLD_MS) {
      return last;
    }
    return createSession();
  });

  // Persist session to user-scoped localStorage key
  const saveSession = useCallback(
    (updated: ChatSession) => {
      const sessions = getSessions(userId).filter((s) => s.id !== updated.id);
      saveSessions(userId, [...sessions, updated]);
    },
    [userId]
  );

  // Show welcome message on first open (no messages yet)
  useEffect(() => {
    if (hasInitialized.current || session.messages.length > 0) return;
    hasInitialized.current = true;
    const welcome = newMsg("assistant", WELCOME);
    const updated = { ...session, messages: [welcome] };
    setSession(updated);
    saveSession(updated);
  }, [session, saveSession]);

  // Auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages]);

  /* ─── data queries (lazy – only fetched when answering) ─── */
  const { refetch: fetchCartoes } = useQuery({
    queryKey: ["chat-cartoes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes")
        .select("*")
        .eq("usuario_id", userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  const { refetch: fetchFaturas } = useQuery({
    queryKey: ["chat-faturas", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturas")
        .select("*")
        .eq("usuario_id", userId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

  /* ─── response generator ─── */
  const generateResponse = useCallback(
    async (text: string): Promise<string> => {
      const lower = text.toLowerCase();
      const now = new Date();
      const target = parseMonthFromText(lower, now);
      const targetStartDate = `${target.ano}-${pad2(target.mes + 1)}-01`;
      const targetEndDate =
        target.mes === 11
          ? `${target.ano + 1}-01-01`
          : `${target.ano}-${pad2(target.mes + 2)}-01`;

      // ── última sessão ──
      if (matchLastSession(lower)) {
        const prev = getPreviousSession(userId);
        if (!prev) {
          return "Não encontrei nenhuma sessão anterior. Esta parece ser a sua primeira conversa comigo! 🎉";
        }
        return formatSessionSummary(prev);
      }

      // ── gastos do mês ──
      if (matchGastos(lower)) {
        const { data: lancamentos, error } = await supabase
          .from("lancamentos")
          .select("*")
          .eq("usuario_id", userId)
          .gte("data", targetStartDate)
          .lt("data", targetEndDate)
          .order("data", { ascending: false });
        if (error) throw error;
        const items = lancamentos ?? [];
        if (!items.length) {
          return `Não encontrei lançamentos para ${MESES[target.mes]} de ${target.ano}.`;
        }
        const despesas = items.filter((l) => {
          const tipo = (l.tipo ?? "").toString().toLowerCase();
          return tipo === "despesa" || tipo === "saida" || (tipo !== "receita" && tipo !== "entrada" && l.valor >= 0);
        });
        const total = despesas.reduce(
          (acc: number, l: { valor: number }) => acc + Math.abs(l.valor),
          0
        );
        const byCategory = despesas.reduce(
          (acc: Record<string, number>, l: { categoria: string; valor: number }) => {
            acc[l.categoria] = (acc[l.categoria] || 0) + Math.abs(l.valor);
            return acc;
          },
          {} as Record<string, number>
        );
        const top = Object.entries(byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat, val]) => `• ${getCategoriaInfo(cat).label}: ${formatCurrency(val)}`)
          .join("\n");

        return `📊 **Gastos em ${MESES[target.mes]}/${target.ano}**\n\n**Total:** ${formatCurrency(total)}\n\n**Por categoria:**\n${top || "Sem categorias identificadas."}`;
      }

      // ── transações recentes ──
      if (matchTransacoes(lower)) {
        const { data: lancamentos, error } = await supabase
          .from("lancamentos")
          .select("*")
          .eq("usuario_id", userId)
          .gte("data", targetStartDate)
          .lt("data", targetEndDate)
          .order("data", { ascending: false });
        if (error) throw error;
        const items = lancamentos ?? [];
        if (!items.length) {
          return `Não encontrei transações para ${MESES[target.mes]} de ${target.ano}.`;
        }
        const recent = items
          .slice(0, 5)
          .map(
            (l: { descricao: string; valor: number; data: string }) =>
              `• ${l.descricao} — ${formatCurrency(l.valor)} (${formatDate(l.data)})`
          )
          .join("\n");

        return `🧾 **Últimas transações de ${MESES[target.mes]}/${target.ano}:**\n\n${recent}`;
      }

      // ── faturas por mês (robusto) ──
      if (matchFaturas(lower)) {
        const [cartoesResult, faturasResult, lancamentosResult] = await Promise.all([
          fetchCartoes(),
          fetchFaturas(),
          supabase
            .from("lancamentos")
            .select("*")
            .eq("usuario_id", userId)
            .gte("data", targetStartDate)
            .lt("data", targetEndDate)
            .not("cartao_id", "is", null),
        ]);

        if (lancamentosResult.error) throw lancamentosResult.error;
        const cartoes = cartoesResult.data ?? [];
        const faturas = (faturasResult.data ?? []).filter((f) => f.mes === target.mes + 1 && f.ano === target.ano);
        const comprasCartao = lancamentosResult.data ?? [];

        const totalByCard = new Map<string, number>();
        comprasCartao.forEach((l) => {
          if (!l.cartao_id) return;
          totalByCard.set(l.cartao_id, (totalByCard.get(l.cartao_id) ?? 0) + Math.abs(l.valor));
        });

        const cardIds = new Set<string>([
          ...Array.from(totalByCard.keys()),
          ...faturas.map((f) => f.cartao_id),
        ]);

        if (cardIds.size === 0) {
          return `Não encontrei faturas/compras de cartão para ${MESES[target.mes]}/${target.ano}.`;
        }

        const lines = Array.from(cardIds).map((cardId) => {
          const cartao = cartoes.find((c) => c.id === cardId);
          const fatura = faturas.find((f) => f.cartao_id === cardId);
          const totalCompras = totalByCard.get(cardId) ?? 0;
          const valor = fatura ? Math.abs(fatura.valor_total) : totalCompras;
          const status = fatura?.status === "pago" ? "Pago" : "Pendente";
          const vencimento = cartao?.vencimento ? `Venc: dia ${cartao.vencimento}` : "Vencimento não informado";
          return `• **${cartao?.nome ?? "Cartão"}** — ${formatCurrency(valor)} | ${status} | ${vencimento}`;
        });

        const totalGeral = lines.length > 0
          ? formatCurrency(Array.from(cardIds).reduce((acc, cardId) => {
              const fatura = faturas.find((f) => f.cartao_id === cardId);
              const fallback = totalByCard.get(cardId) ?? 0;
              return acc + (fatura ? Math.abs(fatura.valor_total) : fallback);
            }, 0))
          : formatCurrency(0);

        return `💳 **Faturas de ${MESES[target.mes]}/${target.ano}**\n\n${lines.join("\n")}\n\n**Total das faturas:** ${totalGeral}`;
      }

      // ── cartões e faturas ──
      if (matchCartoes(lower)) {
        const result = await fetchCartoes();
        const cartoes = result.data ?? [];
        if (!cartoes.length) {
          return "Você não possui cartões cadastrados ainda. Adicione um na aba **Perfil**!";
        }
        const list = cartoes
          .map(
            (c: { nome: string; limite: number; vencimento: number }) =>
              `• **${c.nome}** — Limite: ${formatCurrency(c.limite)} | Vencimento: dia ${c.vencimento}`
          )
          .join("\n");

        return `💳 **Seus cartões:**\n\n${list}`;
      }

      // ── guia de configurações ──
      if (matchConfiguracoes(lower)) {
        const enabledCount = Object.values(userSettings).filter((v) => v === true).length;
        const disabledCount = Object.values(userSettings).filter((v) => v === false).length;
        return `${SETTINGS_GUIDE}\n\n📌 **Seu perfil atual neste dispositivo:** ${enabledCount} opções ativas e ${disabledCount} desativadas.`;
      }

      // ── objetivos ──
      if (matchObjetivos(lower)) {
        return "Para ver seus objetivos e metas financeiras, acesse a aba **Objetivos** no menu inferior! 🎯";
      }

      // ── ajuda ──
      if (matchAjuda(lower)) {
        return (
          "Posso responder sobre:\n\n" +
          "• **Última sessão** — resumo da sua sessão anterior\n" +
          "• **Gastos do mês** — total e por categoria\n" +
          "• **Transações recentes** — últimas compras lançadas\n" +
          "• **Faturas** — por mês (ex.: \"fatura de março\" ou \"fatura mês 3\")\n" +
          "• **Cartões** — seus cartões e limites\n" +
          "• **Configurações** — explico cada opção e como configurar\n" +
          "• **Objetivos** — suas metas financeiras\n\n" +
          'Experimente perguntar: *"fatura de março"*, *"como configurar o app"* ou *"quanto gastei este mês?"*'
        );
      }

      // ── default ──
      return (
        "Não entendi bem sua pergunta 🤔\n\n" +
        'Posso agir como um assistente IA financeiro. Tente: **"fatura mês 3"**, **"me explique as configurações"**, **"gastos de abril"** ou diga **"ajuda"**.'
      );
    },
    [fetchCartoes, fetchFaturas, userId, userSettings]
  );

  /* ─── send handler ─── */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const userMsg = newMsg("user", text);
    const sessionWithUser = {
      ...session,
      messages: [...session.messages, userMsg],
    };
    setSession(sessionWithUser);
    saveSession(sessionWithUser);

    try {
      const responseText = await generateResponse(text);
      const assistantMsg = newMsg("assistant", responseText);
      const sessionWithReply = {
        ...sessionWithUser,
        messages: [...sessionWithUser.messages, assistantMsg],
      };
      setSession(sessionWithReply);
      saveSession(sessionWithReply);
    } catch {
      const errMsg = newMsg(
        "assistant",
        "Ocorreu um erro ao buscar suas informações. Tente novamente."
      );
      const sessionWithErr = {
        ...sessionWithUser,
        messages: [...sessionWithUser.messages, errMsg],
      };
      setSession(sessionWithErr);
      saveSession(sessionWithErr);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ─── render ─── */
  return (
    <div
      className="flex flex-col"
      style={{ height: `calc(100dvh - ${BOTTOM_NAV_HEIGHT})` }}
    >
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Assistente</p>
          <p className="text-xs text-muted-foreground">Financeiro pessoal</p>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {session.messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {loading && (
          <div className="flex gap-2 items-end">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm text-muted-foreground">
              <span className="animate-pulse">Digitando…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input bar */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-3 flex gap-2">
        <Input
          ref={inputRef}
          placeholder="Digite uma mensagem…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          disabled={loading}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || loading}
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

/* ─── message bubble ─── */
const MessageBubble = ({ msg }: { msg: ChatMessage }) => {
  const isUser = msg.role === "user";

  // Render simple **bold** markdown and preserve line breaks
  const renderContent = (text: string) => {
    const boldPattern = /(\*\*[^*\n]+\*\*)/;
    const parts = text.split(boldPattern);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part.split("\n").map((line, j, arr) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ));
    });
  };

  return (
    <div className={cn("flex gap-2 items-end", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {renderContent(msg.content)}
      </div>
    </div>
  );
};

export default Chat;
