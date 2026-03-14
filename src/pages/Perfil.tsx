import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { User, CreditCard, Plus, Trash2, Edit2, LogOut, Check, X, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { Tables } from "@/integrations/supabase/types";
import BrandLogo from "@/components/BrandLogo";
import { getAuthRedirectUrl } from "@/lib/authRedirect";
import { startGoogleOAuth } from "@/lib/googleOAuth";

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

type UserFeatureSettings = {
  autoCategorize: boolean;
  autoSuggestCard: boolean;
  enableTemplates: boolean;
  enablePredictiveSuggestions: boolean;
  enableSplitTransaction: boolean;
  showInvoicePreview: boolean;
  enableRecurringEditScope: boolean;
  enableAdvancedFilters: boolean;
  enableQuickFiltersInicio: boolean;
  enableSearchInicio: boolean;
  enableBatchActionsInicio: boolean;
  enableDashboardInsights: boolean;
  enableCashflowHighlights: boolean;
  showFixedCardExpensesSection: boolean;
  excludeFixedCardFromTotals: boolean;
  blockDuplicateTransactions: boolean;
  enableUndoAfterActions: boolean;
  requireReceiptAboveAmount: boolean;
  receiptMinAmount: number;
  notifyCardClosing: boolean;
  notifyCardDue: boolean;
  notifyAnomalies: boolean;
  notifyMissingReceipt: boolean;
  notifyOrphanTransactions: boolean;
  notifySubscriptionCharges: boolean;
  notifyImportPendingReview: boolean;
  enableImportCenter: boolean;
  enableImportReconciliation: boolean;
  enableCsvImport: boolean;
  enableOfxImport: boolean;
  enableExperimentalFeatures: boolean;
};

const DEFAULT_USER_FEATURE_SETTINGS: UserFeatureSettings = {
  autoCategorize: true,
  autoSuggestCard: true,
  enableTemplates: false,
  enablePredictiveSuggestions: false,
  enableSplitTransaction: false,
  showInvoicePreview: true,
  enableRecurringEditScope: false,
  enableAdvancedFilters: false,
  enableQuickFiltersInicio: false,
  enableSearchInicio: true,
  enableBatchActionsInicio: false,
  enableDashboardInsights: false,
  enableCashflowHighlights: false,
  showFixedCardExpensesSection: true,
  excludeFixedCardFromTotals: true,
  blockDuplicateTransactions: false,
  enableUndoAfterActions: true,
  requireReceiptAboveAmount: false,
  receiptMinAmount: 200,
  notifyCardClosing: true,
  notifyCardDue: true,
  notifyAnomalies: false,
  notifyMissingReceipt: false,
  notifyOrphanTransactions: true,
  notifySubscriptionCharges: false,
  notifyImportPendingReview: false,
  enableImportCenter: false,
  enableImportReconciliation: false,
  enableCsvImport: false,
  enableOfxImport: false,
  enableExperimentalFeatures: false,
};

const getSettingsStorageKey = (userId: string) => `sunshine:settings:${userId}`;

const readSettingsFromStorage = (userId: string): UserFeatureSettings => {
  try {
    const raw = localStorage.getItem(getSettingsStorageKey(userId));
    if (!raw) return DEFAULT_USER_FEATURE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<UserFeatureSettings>;
    return { ...DEFAULT_USER_FEATURE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_USER_FEATURE_SETTINGS;
  }
};

const normalizePhoneE164 = (value: string): string | null => {
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let normalized = digitsOnly;
  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }

  // Assume Brasil when user enters local mobile/landline with DDD.
  if (!normalized.startsWith("55") && (normalized.length === 10 || normalized.length === 11)) {
    normalized = `55${normalized}`;
  }

  if (normalized.length < 12 || normalized.length > 15) return null;
  return `+${normalized}`;
};

const Perfil = () => {
  const { user, session, signOut } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const providers = Array.isArray(user?.app_metadata?.providers)
    ? (user?.app_metadata?.providers as string[])
    : [];
  const hasGoogleProvider = user?.app_metadata?.provider === "google" || providers.includes("google");
  const hasGoogleToken = !!(session as { provider_token?: string | null } | null)?.provider_token;
  const isGoogleSession = hasGoogleProvider || hasGoogleToken;
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

  const { data: whatsappLink } = useQuery({
    queryKey: ["whatsapp-link", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_user_links")
        .select("usuario_id, phone_e164, ativo")
        .eq("usuario_id", user!.id)
        .maybeSingle();
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
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [salvandoWhatsapp, setSalvandoWhatsapp] = useState(false);
  const [revogandoWhatsapp, setRevogandoWhatsapp] = useState(false);
  const [showCartaoModal, setShowCartaoModal] = useState(false);
  const [editCartao, setEditCartao] = useState<Tables<"cartoes"> | null>(null);
  const [featureSettings, setFeatureSettings] = useState<UserFeatureSettings>(DEFAULT_USER_FEATURE_SETTINGS);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setEmail(profile.email);
    }
  }, [profile]);

  useEffect(() => {
    if (whatsappLink?.phone_e164) {
      setWhatsappPhone(whatsappLink.phone_e164);
    }
  }, [whatsappLink?.phone_e164]);

  useEffect(() => {
    if (!user?.id) return;
    setFeatureSettings(readSettingsFromStorage(user.id));
  }, [user?.id]);

  const saveFeatureSettings = (next: UserFeatureSettings) => {
    setFeatureSettings(next);
    if (!user?.id) return;
    try {
      localStorage.setItem(getSettingsStorageKey(user.id), JSON.stringify(next));
    } catch {
      // ignore localStorage failures
    }
  };

  const toggleFeatureSetting = (key: keyof UserFeatureSettings, enabled: boolean) => {
    saveFeatureSettings({ ...featureSettings, [key]: enabled });
  };

  const restoreDefaultSettings = () => {
    saveFeatureSettings(DEFAULT_USER_FEATURE_SETTINGS);
    toast({ title: "Configurações restauradas para o padrão" });
  };

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
    const { error } = await startGoogleOAuth(authRedirectUrl);

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

  const handleSalvarWhatsapp = async () => {
    if (!user?.id) return;

    const normalizedPhone = normalizePhoneE164(whatsappPhone);
    if (!normalizedPhone) {
      toast({
        title: "Numero invalido",
        description: "Use formato com DDI, exemplo: +55 11 99999-0000",
        variant: "destructive",
      });
      return;
    }

    setSalvandoWhatsapp(true);
    try {
      const { error } = await supabase.from("whatsapp_user_links").upsert({
        usuario_id: user.id,
        phone_e164: normalizedPhone,
        ativo: true,
      });
      if (error) throw error;

      setWhatsappPhone(normalizedPhone);
      qc.invalidateQueries({ queryKey: ["whatsapp-link"] });
      toast({ title: "WhatsApp vinculado com sucesso!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro ao salvar WhatsApp", description: message, variant: "destructive" });
    } finally {
      setSalvandoWhatsapp(false);
    }
  };

  const handleRevogarWhatsapp = async () => {
    if (!user?.id) return;
    setRevogandoWhatsapp(true);
    try {
      const { error } = await supabase.from("whatsapp_user_links").delete().eq("usuario_id", user.id);
      if (error) throw error;

      setWhatsappPhone("");
      qc.invalidateQueries({ queryKey: ["whatsapp-link"] });
      toast({ title: "Vinculo WhatsApp removido." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Erro ao revogar WhatsApp", description: message, variant: "destructive" });
    } finally {
      setRevogandoWhatsapp(false);
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
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  value={confirmacaoSenha}
                  onChange={(e) => setConfirmacaoSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={handleSalvarSenha} disabled={salvandoSenha}>
                {salvandoSenha ? "Salvando senha..." : "Salvar senha"}
              </Button>

              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-sm font-medium">Sincronizacao WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Salve o numero que enviara mensagens para o bot (ex.: +55 11 99999-0000).
                </p>
                <Input
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  placeholder="+55 11 99999-0000"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleSalvarWhatsapp} disabled={salvandoWhatsapp}>
                  {salvandoWhatsapp ? "Salvando WhatsApp..." : "Salvar WhatsApp"}
                </Button>
                {whatsappLink?.ativo && whatsappLink.phone_e164 && (
                  <div className="rounded-md bg-success/10 p-2 text-xs text-success space-y-2">
                    <p>Numero vinculado: {whatsappLink.phone_e164}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleRevogarWhatsapp}
                      disabled={revogandoWhatsapp}
                    >
                      {revogandoWhatsapp ? "Revogando..." : "Revogar numero"}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Exemplo de mensagem: "mercado 45,90 hoje alimentacao".
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Sun className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">Configurações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-secondary/50 p-3 text-xs text-muted-foreground">
            Ative ou desative recursos por categoria. As preferências são salvas por usuário neste dispositivo.
          </div>

          <Accordion type="multiple" className="w-full">
            <AccordionItem value="aparencia">
              <AccordionTrigger>Aparência</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Tema</p>
                    <p className="text-xs text-muted-foreground">Escolha entre claro, escuro ou automático</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                      aria-label="Tema claro"
                    >
                      <Sun className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                      aria-label="Tema escuro"
                    >
                      <Moon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("system")}
                      aria-label="Tema do sistema"
                    >
                      <span className="text-xs">Auto</span>
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="lancamentos">
              <AccordionTrigger>Lançamentos e automações</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Auto-categorizar lançamentos"
                  description="Sugere categoria automaticamente por histórico de descrição e loja."
                  checked={featureSettings.autoCategorize}
                  onCheckedChange={(v) => toggleFeatureSetting("autoCategorize", v)}
                />
                <SettingToggleRow
                  title="Sugerir cartão automaticamente"
                  description="Pré-seleciona o cartão mais provável para novas compras."
                  checked={featureSettings.autoSuggestCard}
                  onCheckedChange={(v) => toggleFeatureSetting("autoSuggestCard", v)}
                />
                <SettingToggleRow
                  title="Mostrar prévia da fatura"
                  description="Exibe em qual mês da fatura a compra cairá no formulário."
                  checked={featureSettings.showInvoicePreview}
                  onCheckedChange={(v) => toggleFeatureSetting("showInvoicePreview", v)}
                />
                <SettingToggleRow
                  title="Habilitar templates de lançamento"
                  description="Permite criar lançamentos modelo para uso rápido."
                  checked={featureSettings.enableTemplates}
                  onCheckedChange={(v) => toggleFeatureSetting("enableTemplates", v)}
                />
                <SettingToggleRow
                  title="Habilitar sugestões preditivas"
                  description="Sugere valores e categorias com base no comportamento anterior."
                  checked={featureSettings.enablePredictiveSuggestions}
                  onCheckedChange={(v) => toggleFeatureSetting("enablePredictiveSuggestions", v)}
                />
                <SettingToggleRow
                  title="Habilitar divisão de transação (split)"
                  description="Permite separar um lançamento em múltiplas categorias."
                  checked={featureSettings.enableSplitTransaction}
                  onCheckedChange={(v) => toggleFeatureSetting("enableSplitTransaction", v)}
                />
                <SettingToggleRow
                  title="Edição avançada de recorrência"
                  description="Ao editar fixos, oferecer opções: este, próximos ou todos."
                  checked={featureSettings.enableRecurringEditScope}
                  onCheckedChange={(v) => toggleFeatureSetting("enableRecurringEditScope", v)}
                />
                <SettingToggleRow
                  title="Filtros avançados na lista"
                  description="Habilita filtros por comprovante, valor, cartão e status."
                  checked={featureSettings.enableAdvancedFilters}
                  onCheckedChange={(v) => toggleFeatureSetting("enableAdvancedFilters", v)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="inicio">
              <AccordionTrigger>Aba Início (Dashboard)</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Busca na aba Início"
                  description="Permite pesquisar lançamentos por descrição e loja na tela inicial."
                  checked={featureSettings.enableSearchInicio}
                  onCheckedChange={(v) => toggleFeatureSetting("enableSearchInicio", v)}
                />
                <SettingToggleRow
                  title="Filtros rápidos no Início"
                  description="Ativa chips de filtros rápidos (hoje, semana, mês, com/sem anexo)."
                  checked={featureSettings.enableQuickFiltersInicio}
                  onCheckedChange={(v) => toggleFeatureSetting("enableQuickFiltersInicio", v)}
                />
                <SettingToggleRow
                  title="Ações em lote"
                  description="Permite selecionar vários lançamentos para categorizar, excluir ou marcar em lote."
                  checked={featureSettings.enableBatchActionsInicio}
                  onCheckedChange={(v) => toggleFeatureSetting("enableBatchActionsInicio", v)}
                />
                <SettingToggleRow
                  title="Insights do dashboard"
                  description="Exibe cartões com maior gasto, tendências e alertas de variação."
                  checked={featureSettings.enableDashboardInsights}
                  onCheckedChange={(v) => toggleFeatureSetting("enableDashboardInsights", v)}
                />
                <SettingToggleRow
                  title="Destaques de fluxo de caixa"
                  description="Mostra previsões curtas de entradas e saídas para próximos dias."
                  checked={featureSettings.enableCashflowHighlights}
                  onCheckedChange={(v) => toggleFeatureSetting("enableCashflowHighlights", v)}
                />
                <SettingToggleRow
                  title="Exibir seção de despesas fixas no cartão"
                  description="Mostra a seção dedicada para visualizar despesas fixas do cartão."
                  checked={featureSettings.showFixedCardExpensesSection}
                  onCheckedChange={(v) => toggleFeatureSetting("showFixedCardExpensesSection", v)}
                />
                <SettingToggleRow
                  title="Excluir fixas do cartão dos totais"
                  description="Quando ativo, despesas fixas no cartão não entram no saldo/total geral."
                  checked={featureSettings.excludeFixedCardFromTotals}
                  onCheckedChange={(v) => toggleFeatureSetting("excludeFixedCardFromTotals", v)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="validacao">
              <AccordionTrigger>Validação e segurança</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Bloquear duplicidades suspeitas"
                  description="Alerta antes de salvar lançamentos muito parecidos em curto intervalo."
                  checked={featureSettings.blockDuplicateTransactions}
                  onCheckedChange={(v) => toggleFeatureSetting("blockDuplicateTransactions", v)}
                />
                <SettingToggleRow
                  title="Desfazer após salvar/excluir"
                  description="Mostra ação de desfazer por alguns segundos após operações críticas."
                  checked={featureSettings.enableUndoAfterActions}
                  onCheckedChange={(v) => toggleFeatureSetting("enableUndoAfterActions", v)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comprovantes">
              <AccordionTrigger>Comprovantes</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Exigir comprovante acima de um valor"
                  description="Solicita comprovante automaticamente para despesas maiores."
                  checked={featureSettings.requireReceiptAboveAmount}
                  onCheckedChange={(v) => toggleFeatureSetting("requireReceiptAboveAmount", v)}
                />
                <div className="space-y-1">
                  <Label>Valor mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={featureSettings.receiptMinAmount}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      saveFeatureSettings({
                        ...featureSettings,
                        receiptMinAmount: Number.isFinite(value) && value >= 0 ? value : 0,
                      });
                    }}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="notificacoes">
              <AccordionTrigger>Notificações</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Avisar fechamento próximo da fatura"
                  description="Notifica quando o cartão estiver perto do dia de fechamento."
                  checked={featureSettings.notifyCardClosing}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyCardClosing", v)}
                />
                <SettingToggleRow
                  title="Avisar vencimento próximo"
                  description="Notifica dias antes do vencimento das faturas pendentes."
                  checked={featureSettings.notifyCardDue}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyCardDue", v)}
                />
                <SettingToggleRow
                  title="Avisar anomalias de gasto"
                  description="Detecta gastos fora do padrão e envia alerta."
                  checked={featureSettings.notifyAnomalies}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyAnomalies", v)}
                />
                <SettingToggleRow
                  title="Avisar comprovantes faltantes"
                  description="Lembra de anexar comprovante quando necessário."
                  checked={featureSettings.notifyMissingReceipt}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyMissingReceipt", v)}
                />
                <SettingToggleRow
                  title="Avisar lançamentos órfãos"
                  description="Notifica quando houver despesas sem cartão associado."
                  checked={featureSettings.notifyOrphanTransactions}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyOrphanTransactions", v)}
                />
                <SettingToggleRow
                  title="Detectar cobranças de assinatura"
                  description="Destaca possíveis cobranças recorrentes de serviços."
                  checked={featureSettings.notifySubscriptionCharges}
                  onCheckedChange={(v) => toggleFeatureSetting("notifySubscriptionCharges", v)}
                />
                <SettingToggleRow
                  title="Avisar importações pendentes de revisão"
                  description="Notifica quando houver lançamentos importados aguardando conciliação."
                  checked={featureSettings.notifyImportPendingReview}
                  onCheckedChange={(v) => toggleFeatureSetting("notifyImportPendingReview", v)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="futuro">
              <AccordionTrigger>Importação e recursos futuros</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <SettingToggleRow
                  title="Central de importação e conciliação"
                  description="Prepara o app para importação CSV/OFX com conferência automática."
                  checked={featureSettings.enableImportCenter}
                  onCheckedChange={(v) => toggleFeatureSetting("enableImportCenter", v)}
                />
                <SettingToggleRow
                  title="Conciliação automática"
                  description="Habilita o modo de comparar lançamentos importados com os já existentes."
                  checked={featureSettings.enableImportReconciliation}
                  onCheckedChange={(v) => toggleFeatureSetting("enableImportReconciliation", v)}
                />
                <SettingToggleRow
                  title="Importação CSV"
                  description="Disponibiliza assistente para importar extratos em formato CSV."
                  checked={featureSettings.enableCsvImport}
                  onCheckedChange={(v) => toggleFeatureSetting("enableCsvImport", v)}
                />
                <SettingToggleRow
                  title="Importação OFX"
                  description="Disponibiliza assistente para importar extratos em formato OFX."
                  checked={featureSettings.enableOfxImport}
                  onCheckedChange={(v) => toggleFeatureSetting("enableOfxImport", v)}
                />
                <SettingToggleRow
                  title="Recursos experimentais"
                  description="Ativa novidades em teste antes do lançamento geral."
                  checked={featureSettings.enableExperimentalFeatures}
                  onCheckedChange={(v) => toggleFeatureSetting("enableExperimentalFeatures", v)}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={restoreDefaultSettings}>
              Restaurar padrão
            </Button>
          </div>
        </CardContent>
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

interface SettingToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const SettingToggleRow = ({ title, description, checked, onCheckedChange }: SettingToggleRowProps) => {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
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
