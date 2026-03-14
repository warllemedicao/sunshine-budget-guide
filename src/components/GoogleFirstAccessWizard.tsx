import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  clearPendingGoogleWizard,
  DEFAULT_USER_FEATURE_SETTINGS,
  markGoogleWizardComplete,
  readSettingsFromStorage,
  writeSettingsToStorage,
} from "@/lib/userSettings";

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
  const [selectedDeviceUnlock, setSelectedDeviceUnlock] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPassword("");
      setConfirmPassword("");
      setSelectedDeviceUnlock(false);
    }
  }, [open]);

  const handleUseDeviceUnlock = () => {
    const current = readSettingsFromStorage(userId) ?? DEFAULT_USER_FEATURE_SETTINGS;
    writeSettingsToStorage(userId, {
      ...current,
      enableAppLock: true,
      allowBiometricUnlock: true,
      requirePasswordForGoogle: false,
    });
    setSelectedDeviceUnlock(true);
    setStep(2);
  };

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
    clearPendingGoogleWizard();
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
            Para proteger seus dados, escolha agora como deseja desbloquear o app:
            <strong> senha de acesso</strong> ou <strong>desbloqueio do aparelho</strong>.
          </p>
        </div>
      ),
      footer: (
        <div className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => setStep(1)}>
            Configurar senha →
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleUseDeviceUnlock}
          >
            Usar desbloqueio do aparelho
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
      title: selectedDeviceUnlock ? "✅ Configuração concluída" : "✅ Senha definida!",
      content: (
        <div className="space-y-4 text-center">
          <div className="text-5xl">{selectedDeviceUnlock ? "📱" : "🔒"}</div>
          {selectedDeviceUnlock ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Tudo pronto! O app ficará protegido com o desbloqueio do seu aparelho.
              Se quiser, você pode definir uma senha depois em <strong>Perfil → Segurança</strong>.
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
          <DialogDescription className="text-center text-xs text-muted-foreground">
            Configuração de segurança no primeiro acesso da conta.
          </DialogDescription>
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
