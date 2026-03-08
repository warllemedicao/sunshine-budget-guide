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
  'Olá! 👋 Sou seu assistente financeiro. Posso te ajudar com informações sobre seus gastos, transações, cartões e objetivos.\n\nDiga **"última sessão"** para ver um resumo da sua sessão anterior, ou pergunte sobre seus gastos do mês!';

const BOTTOM_NAV_HEIGHT = "5rem";

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

const matchObjetivos = (t: string) =>
  is(t, /objetivo/i, /meta/i, /planejamento/i);

const matchAjuda = (t: string) =>
  is(t, /ajuda/i, /help/i, /o que (você|vc) (faz|sabe)/i, /comandos?/i);

/* ─── component ─── */
const Chat = () => {
  const { user } = useAuth();
  const userId = user!.id;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Initialize session scoped to the current user
  const [session, setSession] = useState<ChatSession>(() => {
    const sessions = getSessions(userId);
    const last = sessions[sessions.length - 1];
    // Reuse a session started < 2 h ago for the same user
    if (last && Date.now() - last.startedAt < 2 * 60 * 60 * 1000) {
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
  const now = new Date();
  const mes = now.getMonth();
  const ano = now.getFullYear();
  const startDate = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const endDate =
    mes === 11
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 2).padStart(2, "0")}-01`;

  const { refetch: fetchLancamentos } = useQuery({
    queryKey: ["chat-lancamentos", userId, mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("*")
        .eq("usuario_id", userId)
        .gte("data", startDate)
        .lt("data", endDate)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: false,
  });

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

  /* ─── response generator ─── */
  const generateResponse = useCallback(
    async (text: string): Promise<string> => {
      const lower = text.toLowerCase();

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
        const result = await fetchLancamentos();
        const lancamentos = result.data ?? [];
        if (!lancamentos.length) {
          return `Não encontrei lançamentos para ${MESES[mes]} de ${ano}.`;
        }
        const total = lancamentos.reduce(
          (acc: number, l: { valor: number }) => acc + l.valor,
          0
        );
        const byCategory = lancamentos.reduce(
          (acc: Record<string, number>, l: { categoria: string; valor: number }) => {
            acc[l.categoria] = (acc[l.categoria] || 0) + l.valor;
            return acc;
          },
          {} as Record<string, number>
        );
        const top = Object.entries(byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat, val]) => `• ${getCategoriaInfo(cat).label}: ${formatCurrency(val)}`)
          .join("\n");

        return `📊 **Gastos em ${MESES[mes]}/${ano}**\n\n**Total:** ${formatCurrency(total)}\n\n**Por categoria:**\n${top}`;
      }

      // ── transações recentes ──
      if (matchTransacoes(lower)) {
        const result = await fetchLancamentos();
        const lancamentos = result.data ?? [];
        if (!lancamentos.length) {
          return `Não encontrei transações para ${MESES[mes]} de ${ano}.`;
        }
        const recent = lancamentos
          .slice(0, 5)
          .map(
            (l: { descricao: string; valor: number; data: string }) =>
              `• ${l.descricao} — ${formatCurrency(l.valor)} (${formatDate(l.data)})`
          )
          .join("\n");

        return `🧾 **Últimas transações de ${MESES[mes]}/${ano}:**\n\n${recent}`;
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
          "• **Cartões** — seus cartões e limites\n" +
          "• **Objetivos** — suas metas financeiras\n\n" +
          'Experimente perguntar: *"quanto gastei este mês?"* ou *"qual foi minha última sessão?"*'
        );
      }

      // ── default ──
      return (
        "Não entendi bem sua pergunta 🤔\n\n" +
        'Tente perguntar sobre **gastos**, **transações**, **cartões** ou diga **"ajuda"** para ver o que posso fazer.'
      );
    },
    [fetchLancamentos, fetchCartoes, userId, mes, ano]
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
