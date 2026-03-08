export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  startedAt: number;
  messages: ChatMessage[];
}

const MAX_SESSIONS = 20;
/** Sessions are stored per-user to avoid data leaking between accounts. */
const storageKey = (userId: string) => `sunshine_chat_sessions_${userId}`;

export function getSessions(userId: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSessions(userId: string, sessions: ChatSession[]): void {
  const trimmed = sessions.slice(-MAX_SESSIONS);
  localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
}

export function createSession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    messages: [],
  };
}

/** Returns the most recent completed session (second-to-last saved). */
export function getPreviousSession(userId: string): ChatSession | null {
  const sessions = getSessions(userId);
  if (sessions.length < 2) return null;
  return sessions[sessions.length - 2];
}

export function formatSessionSummary(session: ChatSession): string {
  const date = new Date(session.startedAt);
  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const userMessages = session.messages.filter((m) => m.role === "user");

  if (userMessages.length === 0) {
    return `📅 **Última sessão:** ${formatted}\n\nNenhuma mensagem foi enviada nessa sessão.`;
  }

  const topics = userMessages
    .slice(0, 5)
    .map((m) => `• ${m.content}`)
    .join("\n");

  return `📅 **Última sessão:** ${formatted}\n💬 **Mensagens enviadas:** ${userMessages.length}\n\n**O que foi perguntado:**\n${topics}`;
}
