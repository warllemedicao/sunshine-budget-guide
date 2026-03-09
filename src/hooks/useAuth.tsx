import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const UNLOCK_SESSION_KEY = "app_session_unlocked";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  locked: boolean;
  unlock: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  locked: false,
  unlock: () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const lastHandledNativeUrl = useRef<string | null>(null);

  const handleNativeAuthUrl = async (url: string) => {
    if (!url || lastHandledNativeUrl.current === url) return;
    lastHandledNativeUrl.current = url;

    const safeUrl = url.replace("gilfinanceiro://", "https://gilfinanceiro.local/");
    const parsed = new URL(safeUrl);
    const hashParams = new URLSearchParams(parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash);
    const queryParams = parsed.searchParams;

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code = queryParams.get("code");

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      const { Browser } = await import("@capacitor/browser");
      await Browser.close().catch(() => {
        // Browser may already be closed depending on the OS/webview behavior.
      });
      if (error) {
        console.error("Falha ao aplicar sessao OAuth nativa:", error.message);
      }
      return;
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      const { Browser } = await import("@capacitor/browser");
      await Browser.close().catch(() => {
        // Browser may already be closed depending on the OS/webview behavior.
      });
      if (error) {
        console.error("Falha ao trocar code por sessao OAuth:", error.message);
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      // Lock the app whenever a new session is detected and the current
      // browser session has not yet been unlocked.
      if (session && sessionStorage.getItem(UNLOCK_SESSION_KEY) !== "true") {
        setLocked(true);
      } else if (!session) {
        setLocked(false);
        sessionStorage.removeItem(UNLOCK_SESSION_KEY);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session && sessionStorage.getItem(UNLOCK_SESSION_KEY) !== "true") {
        setLocked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const registerNativeAuthListener = async () => {
      const [{ Capacitor }, { App }] = await Promise.all([
        import("@capacitor/core"),
        import("@capacitor/app"),
      ]);

      if (!Capacitor.isNativePlatform()) return;

      const listener = await App.addListener("appUrlOpen", async ({ url }) => {
        await handleNativeAuthUrl(url);
      });

      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        await handleNativeAuthUrl(launchUrl.url);
      }

      cleanup = () => {
        void listener.remove();
      };
    };

    registerNativeAuthListener().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Falha ao registrar listener OAuth nativo:", message);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const unlock = () => {
    sessionStorage.setItem(UNLOCK_SESSION_KEY, "true");
    setLocked(false);
  };

  const signOut = async () => {
    sessionStorage.removeItem(UNLOCK_SESSION_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, locked, unlock, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
