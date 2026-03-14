import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { startGoogleOAuth } from "@/lib/googleOAuth";
import { clearPendingGoogleWizard, setPendingGoogleWizard } from "@/lib/userSettings";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const authRedirectUrl = getAuthRedirectUrl();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome },
            emailRedirectTo: authRedirectUrl,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Verifique seu email para confirmar o cadastro.",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      // Tutorial de 1º acesso Google só pode aparecer quando o usuário escolhe
      // explicitamente fluxo de cadastro (não no login comum).
      if (isLogin) {
        clearPendingGoogleWizard();
      } else {
        setPendingGoogleWizard();
      }
      const { error } = await startGoogleOAuth(authRedirectUrl);
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro inesperado";
      toast({
        title: "Erro ao entrar com Google",
        description: message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Wallet className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Meu Financeiro</CardTitle>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <Input
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required={!isLogin}
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleGoogleAuth}>
              {loading ? "Aguarde..." : "Continuar com Google"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
