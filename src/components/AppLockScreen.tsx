import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Lock, Mail } from "lucide-react";

interface AppLockScreenProps {
  userEmail: string;
  onUnlock: () => void;
}

const BIOMETRIC_CREDENTIAL_KEY = "app_biometric_credential_id";
const MAX_BIOMETRIC_FAILURES = 5;

// Utility: convert ArrayBuffer to Base64 string
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

// Utility: convert Base64 string to Uint8Array
const base64ToBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer;
};

const isBiometricSupported = (): boolean =>
  typeof window !== "undefined" &&
  !!window.PublicKeyCredential &&
  !!navigator.credentials;

const AppLockScreen = ({ userEmail, onUnlock }: AppLockScreenProps) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"biometric" | "password" | "recovery">("biometric");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricFailures, setBiometricFailures] = useState(0);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(userEmail);
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    setHasBiometric(!!stored && isBiometricSupported());
    // If biometric not registered or not supported, go straight to password
    if (!stored || !isBiometricSupported()) {
      setMode("password");
    }
  }, []);

  const handleBiometricAuth = async () => {
    setLoading(true);
    try {
      const credentialIdBase64 = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
      if (!credentialIdBase64) {
        setMode("password");
        return;
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            {
              id: base64ToBuffer(credentialIdBase64),
              type: "public-key",
            },
          ],
          userVerification: "required",
          timeout: 60000,
        },
      });

      if (assertion) {
        onUnlock();
      }
    } catch (err: unknown) {
      const newFailures = biometricFailures + 1;
      setBiometricFailures(newFailures);
      if (newFailures >= MAX_BIOMETRIC_FAILURES) {
        toast({
          title: "Muitas tentativas",
          description: "Insira sua senha para continuar.",
          variant: "destructive",
        });
        setMode("password");
      } else {
        toast({
          title: "Digital não reconhecida",
          description: `Tentativa ${newFailures}/${MAX_BIOMETRIC_FAILURES}. Tente novamente.`,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometric = async () => {
    if (!isBiometricSupported()) {
      toast({
        title: "Não suportado",
        description: "Seu dispositivo não suporta autenticação biométrica.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "Meu Financeiro", id: window.location.hostname },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: userEmail,
            displayName: userEmail,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            requireResidentKey: false,
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null;

      if (credential) {
        const credentialId = bufferToBase64(credential.rawId);
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
        setHasBiometric(true);
        setMode("biometric");
        toast({ title: "Digital cadastrada com sucesso!" });
      }
    } catch (err: unknown) {
      toast({
        title: "Erro ao cadastrar digital",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password,
      });
      if (error) throw error;
      onUnlock();
    } catch (err: unknown) {
      toast({
        title: "Senha incorreta",
        description: err instanceof Error ? err.message : "Verifique sua senha e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setRecoverySent(true);
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada." });
    } catch (err: unknown) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Desbloquear App</CardTitle>
          <p className="text-sm text-muted-foreground">{userEmail}</p>
        </CardHeader>

        <CardContent className="space-y-4">
          {mode === "biometric" && (
            <div className="flex flex-col items-center gap-4">
              <Button
                className="w-full gap-2"
                onClick={handleBiometricAuth}
                disabled={loading}
              >
                <Fingerprint className="h-5 w-5" />
                {loading ? "Verificando..." : "Usar Digital"}
              </Button>
              {biometricFailures > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {biometricFailures}/{MAX_BIOMETRIC_FAILURES} tentativas
                </p>
              )}
              <button
                type="button"
                onClick={() => setMode("password")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Usar senha
              </button>
            </div>
          )}

          {mode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Entrar"}
              </Button>
              <div className="flex flex-col gap-2 items-center">
                {hasBiometric && (
                  <button
                    type="button"
                    onClick={() => setMode("biometric")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Fingerprint className="h-4 w-4" /> Usar digital
                  </button>
                )}
                {isBiometricSupported() && !hasBiometric && (
                  <button
                    type="button"
                    onClick={handleRegisterBiometric}
                    disabled={loading}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Fingerprint className="h-4 w-4" /> Cadastrar digital
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMode("recovery")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <Mail className="h-4 w-4" /> Esqueci minha senha
                </button>
              </div>
            </form>
          )}

          {mode === "recovery" && (
            <div className="space-y-3">
              {recoverySent ? (
                <div className="rounded-lg bg-success/10 p-4 text-center space-y-2">
                  <Mail className="h-8 w-8 text-success mx-auto" />
                  <p className="text-sm font-medium">Email enviado!</p>
                  <p className="text-xs text-muted-foreground">
                    Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  </p>
                </div>
              ) : (
                <form onSubmit={handlePasswordRecovery} className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Enviaremos um link de recuperação para seu email.
                  </p>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" className="w-full gap-2" disabled={loading}>
                    <Mail className="h-4 w-4" />
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                </form>
              )}
              <button
                type="button"
                onClick={() => setMode("password")}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppLockScreen;
