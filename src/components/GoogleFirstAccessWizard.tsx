import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { markGoogleWizardComplete } from "@/lib/userSettings";

interface Props {
  userId: string;
  userEmail: string;
  open: boolean;
  onComplete: () => void;
}

const GoogleFirstAccessWizard = ({ userId, userEmail, open, onComplete }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skipPassword, setSkipPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPassword("");
      setConfirmPassword("");
      setSkipPassword(false);
    }
  }, [open]);

  const handleSetPassword = async () => {
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao definir senha", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Senha definida!", description: "Na próxima vez que o app ficar travado, use esta senha." });
    setStep(2);
  };

  const handleComplete = () => {
    markGoogleWizardComplete(userId);
    onComplete();
  };

  const steps = [
    {
      title: "👋 Primeiro acesso via Google",
      content: (
        <div className="space-y-4 text-center">
          <div className="text-5xl">☀️</div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Bem-vindo ao <strong>Sunshine Budget</strong>! Você entrou com sua conta
            Google (<span className="font-medium">{userEmail}</span>).
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Para proteger seus dados, recomendamos configurar uma <strong>senha de desbloqueio</strong>.
            Ela será solicitada sempre que o app for reaberto.
          </p>
        </div>
      ),
      footer: (
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => setStep(1)}>
            Configurar senha →
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground text-xs"
            onClick={() => { setSkipPassword(true); setStep(2); }}
          >
            Pular por enquanto
          </Button>
        </div>
      ),
    },
    {
      title: "🔐 Defina sua senha de acesso",
      content: (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            Esta senha será usada para desbloquear o app quando você o reabrir.
            Pode ser diferente da sua senha do Google.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="wiz-pass">Nova senha</Label>
            <Input
              id="wiz-pass"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wiz-pass-confirm">Confirmar senha</Label>
            <Input
              id="wiz-pass-confirm"
              type="password"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
      ),
      footer: (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
            Voltar
          </Button>
          <Button disabled={submitting} onClick={handleSetPassword} className="flex-1">
            {submitting ? "Salvando..." : "Definir senha"}
          </Button>
        </div>
      ),
    },
    {
      title: skipPassword ? "✅ Configuração concluída" : "✅ Senha definida!",
      content: (
        <div className="space-y-4 text-center">
          <div className="text-5xl">{skipPassword ? "🎉" : "🔒"}</div>
          {skipPassword ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tudo pronto! Você pode configurar uma senha depois em{" "}
              <strong>Perfil → Segurança</strong>.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Ótimo! Sua senha foi definida. Da próxima vez que o app travar,
              basta digitar essa senha para desbloquear.
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            Explore seus <strong>Objetivos</strong>, <strong>Lançamentos</strong> e{" "}
            <strong>Gráficos</strong>. Bom planejamento! ☀️
          </p>
        </div>
      ),
      footer: (
        <Button className="w-full" onClick={handleComplete}>
          Começar a usar o app →
        </Button>
      ),
    },
  ];

  const current = steps[step];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" hideClose>
        <DialogHeader>
          <DialogTitle className="text-center text-base">{current.title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">{current.content}</div>
        {/* Step dots */}
        <div className="flex justify-center gap-1.5 my-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-4 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        {current.footer}
      </DialogContent>
    </Dialog>
  );
};

export default GoogleFirstAccessWizard;
