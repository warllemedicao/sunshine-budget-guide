import { useState, useEffect } from "react";
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
import { User, CreditCard, Plus, Trash2, Edit2, LogOut, Check, X, Wand2 } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import BrandLogo from "@/components/BrandLogo";
import { backfillMerchantLogos } from "@/lib/merchantLogo";

const Perfil = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ["cartoes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").eq("user_id", user!.id).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [showCartaoModal, setShowCartaoModal] = useState(false);
  const [editCartao, setEditCartao] = useState<Tables<"cartoes"> | null>(null);

  // Backfill state
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [backfillResult, setBackfillResult] = useState<{ processed: number; succeeded: number; failed: number } | null>(null);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome);
      setEmail(profile.email);
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ nome, email }).eq("user_id", user!.id);
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

  const handleBackfill = async () => {
    if (!user) return;
    setBackfilling(true);
    setBackfillResult(null);
    setBackfillProgress({ done: 0, total: 0, current: "" });
    const result = await backfillMerchantLogos(user.id, (done, total, current) => {
      setBackfillProgress({ done, total, current });
    });
    setBackfillResult(result);
    setBackfilling(false);
    if (result.processed === 0) {
      toast({ title: "Nenhum lançamento sem logo encontrado." });
    } else {
      toast({
        title: `${result.succeeded} logo(s) recuperado(s)!`,
        description: result.failed > 0 ? `${result.failed} loja(s) não encontrada(s).` : undefined,
      });
    }
    qc.invalidateQueries({ queryKey: ["lancamentos"] });
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4">
      <h1 className="text-xl font-bold">Perfil</h1>

      {/* Profile card */}
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
          <CardContent className="space-y-2">
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
          </CardContent>
        )}
      </Card>

      {/* Cards management */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Meus Cartões</CardTitle>
          <button onClick={() => { setEditCartao(null); setShowCartaoModal(true); }}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-2">
          {cartoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>}
          {cartoes.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
              <div>
                <p className="text-sm font-medium">{c.instituicao}</p>
                <p className="text-xs text-muted-foreground">
                  •••• {c.final_cartao} · Limite: {formatCurrency(c.limite)} · Fech: {c.dia_fechamento} · Venc: {c.dia_vencimento}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditCartao(c); setShowCartaoModal(true); }}
                  className="p-1 text-muted-foreground hover:text-foreground">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button onClick={() => deleteCartao.mutate(c.id)}
                  className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Logo backfill card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Recuperar logos antigos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Preenche automaticamente as logos dos lançamentos que ainda não têm imagem salva.
          </p>

          {backfilling && backfillProgress && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: backfillProgress.total > 0
                      ? `${Math.round((backfillProgress.done / backfillProgress.total) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {backfillProgress.total === 0
                  ? "Buscando lançamentos…"
                  : backfillProgress.done < backfillProgress.total
                    ? `${backfillProgress.done}/${backfillProgress.total} — ${backfillProgress.current}`
                    : "Concluído!"}
              </p>
            </div>
          )}

          {backfillResult && !backfilling && (
            <p className="text-sm">
              {backfillResult.processed === 0
                ? "Nenhum lançamento sem logo encontrado."
                : `✅ ${backfillResult.succeeded} recuperado(s)${backfillResult.failed > 0 ? `, ❌ ${backfillResult.failed} não encontrado(s)` : ""}.`}
            </p>
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleBackfill}
            disabled={backfilling}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            {backfilling ? "Recuperando…" : "Recuperar logos"}
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sair
      </Button>

      <CartaoModal
        open={showCartaoModal}
        onOpenChange={setShowCartaoModal}
        editItem={editCartao}
        userId={user?.id || ""}
      />
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
  const [instituicao, setInstituicao] = useState("");
  const [debouncedInstituicao, setDebouncedInstituicao] = useState("");
  const [bandeira, setBandeira] = useState("");
  const [finalCartao, setFinalCartao] = useState("");
  const [limite, setLimite] = useState("");
  const [diaFech, setDiaFech] = useState("1");
  const [diaVenc, setDiaVenc] = useState("10");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editItem) {
      setInstituicao(editItem.instituicao);
      setBandeira(editItem.bandeira);
      setFinalCartao(editItem.final_cartao);
      setLimite(String(editItem.limite));
      setDiaFech(String(editItem.dia_fechamento));
      setDiaVenc(String(editItem.dia_vencimento));
    } else {
      setInstituicao(""); setBandeira(""); setFinalCartao("");
      setLimite(""); setDiaFech("1"); setDiaVenc("10");
    }
  }, [editItem, open]);

  // Debounce instituicao changes so the logo API is not called on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedInstituicao(instituicao), 500);
    return () => clearTimeout(timer);
  }, [instituicao]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        instituicao, bandeira, final_cartao: finalCartao,
        limite: +limite, dia_fechamento: +diaFech, dia_vencimento: +diaVenc,
      };
      if (editItem) {
        const { error } = await supabase.from("cartoes").update(payload).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cartoes").insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["cartoes"] });
      toast({ title: editItem ? "Cartão atualizado!" : "Cartão adicionado!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
            <Label>Instituição</Label>
            <div className="flex items-center gap-2">
              <Input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} required className="flex-1" />
              {debouncedInstituicao && <BrandLogo store={debouncedInstituicao} size={32} />}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Bandeira</Label><Input value={bandeira} onChange={(e) => setBandeira(e.target.value)} placeholder="Visa, Master..." /></div>
            <div className="space-y-1"><Label>Final</Label><Input value={finalCartao} onChange={(e) => setFinalCartao(e.target.value)} maxLength={4} placeholder="1234" /></div>
          </div>
          <div className="space-y-1"><Label>Limite (R$)</Label><Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Dia fechamento</Label><Input type="number" min="1" max="31" value={diaFech} onChange={(e) => setDiaFech(e.target.value)} /></div>
            <div className="space-y-1"><Label>Dia vencimento</Label><Input type="number" min="1" max="31" value={diaVenc} onChange={(e) => setDiaVenc(e.target.value)} /></div>
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
