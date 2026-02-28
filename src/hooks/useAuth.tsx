import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
