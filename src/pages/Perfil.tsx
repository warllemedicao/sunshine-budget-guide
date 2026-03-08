import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { User, CreditCard, Plus, Trash2, Edit2, LogOut, Check, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import BrandLogo from "@/components/BrandLogo";
import { getAuthRedirectUrl } from "@/lib/authRedirect";

const BANK_SUGGESTIONS = [
  "Nubank",
  "Caixa",
  "Santander",
  "Bradesco",
  "Itau",
  "Banco do Brasil",
  "Inter",
  "PicPay",
  "Mercado Pago",
  "PagBank",
];

const Perfil = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isGoogleSession = user?.app_metadata?.provider === "google";
  const authRedirectUrl = getAuthRedirectUrl();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      // PGRST116: no rows returned for .single() — expected when no profile exists yet
      const { data, error } = await supabase.from("usuarios").select("*").eq("id", user!.id).single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").eq("usuario_id", user!.id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacaoSenha, setConfirmacaoSenha] = useState("");
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [revogandoGoogle, setRevogandoGoogle] = useState(false);
  const [showCartaoModal, setShowCartaoModal] = useState(false);
  const [editCartao, setEditCartao] = useState<Tables<"cartoes"> | null>(null);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setEmail(profile.email);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("usuarios").update({ nome, email }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditingProfile(false);
      toast({ title: "Perfil atualizado!" });
    },
  });

  const deleteCartao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartoes"] });
      toast({ title: "Cartão removido!" });
    },
  });

  const connectGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectUrl,
        scopes: "openid email profile https://www.googleapis.com/auth/drive.file",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      toast({ title: "Erro ao conectar Google", description: error.message, variant: "destructive" });
    }
  };

  const handleSalvarSenha = async () => {
    if (novaSenha.length < 6) {
      toast({ title: "Senha invalida", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== confirmacaoSenha) {
      toast({ title: "Senhas diferentes", description: "Confirme a senha corretamente.", variant: "destructive" });
      return;
    }

    setSalvandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      setNovaSenha("");
      setConfirmacaoSenha("");
      toast({ title: "Senha atualizada com sucesso!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro ao atualizar senha", description: message, variant: "destructive" });
    } finally {
      setSalvandoSenha(false);
    }
  };

  const handleRevogarGoogle = async () => {
    setRevogandoGoogle(true);
    try {
      const { data } = await supabase.auth.getSession();
      const providerToken = (data.session as { provider_token?: string | null } | null)?.provider_token;

      if (providerToken) {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: providerToken }).toString(),
        });
      }

      await signOut();
      toast({ title: "Conexao Google revogada", description: "Faca login novamente para reconectar." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro ao revogar conexao", description: message, variant: "destructive" });
    } finally {
      setRevogandoGoogle(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4">
      <h1 className="text-xl font-bold">Perfil</h1>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{profile?.nome || "Usuário"}</CardTitle>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>
          <button onClick={() => setEditingProfile(!editingProfile)} className="p-1 text-muted-foreground hover:text-foreground">
            {editingProfile ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
          </button>
        </CardHeader>
        {editingProfile && (
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => updateProfile.mutate()}>
              <Check className="h-4 w-4 mr-1" /> Salvar
            </Button>

            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-sm font-medium">Seguranca da Conta</p>
              {!isGoogleSession && (
                <p className="text-xs text-muted-foreground">Conecte sua conta Google para salvar comprovantes na sua nuvem.</p>
              )}
              {!isGoogleSession && (
                <Button type="button" variant="outline" size="sm" onClick={connectGoogle}>
                  Conectar com Google
                </Button>
              )}
              {isGoogleSession && (
                <div className="space-y-2">
                  <p className="text-xs text-success">Conta Google conectada para upload de comprovantes.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRevogarGoogle}
                    disabled={revogandoGoogle}
                  >
                    {revogandoGoogle ? "Revogando..." : "Revogar conexao Google"}
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <Label>{isGoogleSession ? "Definir ou alterar senha de acesso" : "Alterar senha de acesso"}</Label>
                <Input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Nova senha"
                />
              </div>
              <div className="space-y-1">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirmacaoSenha}
                  onChange={(e) => setConfirmacaoSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleSalvarSenha} disabled={salvandoSenha}>
                {salvandoSenha ? "Salvando senha..." : "Salvar senha"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Meus Cartões</CardTitle>
          <button
            onClick={() => {
              setEditCartao(null);
              setShowCartaoModal(true);
            }}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-2">
          {cartoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
          {cartoes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
              <div className="flex items-center gap-2 min-w-0">
                <BrandLogo
                  store={c.nome}
                  size={28}
                  initialUrl={c.logo_url}
                  merchantId={c.merchant_id}
                  fallbackIcon={<CreditCard className="h-4 w-4 text-primary" />}
                  fallbackBg="hsl(var(--primary) / 0.1)"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Limite: {formatCurrency(c.limite)} · Fech: {c.fechamento} · Venc: {c.vencimento}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditCartao(c);
                    setShowCartaoModal(true);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => deleteCartao.mutate(c.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sair
      </Button>

      <CartaoModal open={showCartaoModal} onOpenChange={setShowCartaoModal} editItem={editCartao} userId={user?.id || ""} />
    </div>
  );
};

interface CartaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem: Tables<"cartoes"> | null;
  userId: string;
}

const CartaoModal = ({ open, onOpenChange, editItem, userId }: CartaoModalProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [debouncedNome, setDebouncedNome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [limite, setLimite] = useState("");
  const [fechamento, setFechamento] = useState("1");
  const [vencimento, setVencimento] = useState("10");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setNome(editItem.nome);
      setLogoUrl(editItem.logo_url ?? null);
      setMerchantId(editItem.merchant_id ?? null);
      setLimite(String(editItem.limite));
      setFechamento(String(editItem.fechamento));
      setVencimento(String(editItem.vencimento));
    } else {
      setLogoUrl(null);
      setMerchantId(null);
      setNome("");
      setLimite("");
      setFechamento("1");
      setVencimento("10");
    }
  }, [editItem, open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNome(nome), 500);
    return () => clearTimeout(timer);
  }, [nome]);

  const cardSuggestions = useMemo(() => {
    const term = nome.trim().toLowerCase();
    if (term.length < 2) return [];
    return BANK_SUGGESTIONS.filter((bank) => bank.toLowerCase().includes(term)).slice(0, 5);
  }, [nome]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        nome,
        logo_url: logoUrl,
        merchant_id: merchantId,
        limite: +limite,
        fechamento: +fechamento,
        vencimento: +vencimento,
      };

      if (editItem) {
        const { error } = await supabase.from("cartoes").update(payload).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert({ ...payload, usuario_id: userId });
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ["cartoes"] });
      toast({ title: editItem ? "Cartão atualizado!" : "Cartão adicionado!" });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Cartão" : "Novo Cartão"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Nome do Cartão</Label>
            <div className="flex items-center gap-2">
              <Input
                value={nome}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setNome(nextName);
                  if (editItem && nextName.trim().toLowerCase() !== editItem.nome.trim().toLowerCase()) {
                    setLogoUrl(null);
                    setMerchantId(null);
                  }
                }}
                required
                className="flex-1"
              />
              {debouncedNome && (
                <BrandLogo
                  store={debouncedNome}
                  size={32}
                  initialUrl={logoUrl}
                  merchantId={merchantId}
                  onLogoResolved={setLogoUrl}
                  onMerchantResolved={setMerchantId}
                />
              )}
            </div>
            {cardSuggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Sugestoes de bancos (max. 5):</p>
                <div className="grid grid-cols-1 gap-1">
                  {cardSuggestions.map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-left hover:bg-secondary"
                      onClick={() => {
                        setNome(bank);
                        setLogoUrl(null);
                        setMerchantId(null);
                      }}
                    >
                      <BrandLogo store={bank} size={18} />
                      <span className="text-xs">{bank}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Limite (R$)</Label>
            <Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Dia fechamento</Label>
              <Input type="number" min="1" max="31" value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Dia vencimento</Label>
              <Input type="number" min="1" max="31" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : editItem ? "Atualizar" : "Adicionar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Perfil;
