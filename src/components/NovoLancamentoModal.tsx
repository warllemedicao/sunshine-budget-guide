import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIAS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { ReceiptUploadButton } from '@/components/ReceiptUploadButton';
import { ReceiptViewer } from '@/components/ReceiptViewer';
import { LogoImage } from "@/lib/logos";
import { parseBankNotification } from "@/lib/notificationParser";
import { Smartphone, X } from "lucide-react";
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: Tables<"lancamentos"> | null;
}

const NovoLancamentoModal = ({ open, onOpenChange, editItem }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [categoria, setCategoria] = useState("outros");
  const [fixo, setFixo] = useState(false);
  const [metodo, setMetodo] = useState<"avista" | "cartao">("avista");
  const [cartaoId, setCartaoId] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("1");
  const [loja, setLoja] = useState("");
  const [cartoes, setCartoes] = useState<Tables<"cartoes">[]>([]);
  const [loading, setLoading] = useState(false);
  // Estados para comprovante
  const [receiptPath, setReceiptPath] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  // Estado para importar notificação do banco
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifText, setNotifText] = useState("");

  useEffect(() => {
    if (!user || !open) return;
    supabase.from("cartoes").select("*").eq("user_id", user.id).then(({ data }) => {
      if (data) setCartoes(data);
    });
  }, [user, open]);

  useEffect(() => {
    if (editItem) {
      setTipo(editItem.tipo as "receita" | "despesa");
      setDescricao(editItem.descricao);
      setValor(String(editItem.valor));
      setData(editItem.data);
      setCategoria(editItem.categoria);
      setFixo(editItem.fixo);
      setMetodo(editItem.metodo as "avista" | "cartao");
      setCartaoId(editItem.cartao_id || "");
      setTotalParcelas(String(editItem.total_parcelas || 1));
      setLoja(editItem.loja || "");
      setReceiptPath(editItem.comprovante_url || "");
      setReceiptFileName(editItem.comprovante_url ? "Comprovante" : "");
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const resetForm = () => {
    setTipo("despesa");
    setDescricao("");
    setValor("");
    setData(new Date().toISOString().split("T")[0]);
    setCategoria("outros");
    setFixo(false);
    setMetodo("avista");
    setCartaoId("");
    setTotalParcelas("1");
    setLoja("");
    setReceiptPath("");
    setReceiptFileName("");
    setShowNotifPanel(false);
    setNotifText("");
  };

  const handleImportNotif = () => {
    const parsed = parseBankNotification(notifText);
    if (parsed.valor) setValor(String(parsed.valor));
    if (parsed.loja) setLoja(parsed.loja);
    if (parsed.descricao) setDescricao(parsed.descricao);
    setShowNotifPanel(false);
    setNotifText("");
    toast({ title: "Notificação importada!", description: "Confira os dados e ajuste se necessário." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (metodo === "cartao" && !cartaoId) {
      toast({ title: "Selecione um cartão", description: "É necessário selecionar um cartão para lançamentos no cartão.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const valorNum = parseFloat(valor);
      if (isNaN(valorNum) || valorNum <= 0) throw new Error("Valor inválido");

      if (editItem) {
        const { error } = await supabase
          .from("lancamentos")
          .update({
            tipo, descricao, valor: valorNum, data, categoria, fixo,
            metodo, cartao_id: metodo === "cartao" ? cartaoId || null : null,
            total_parcelas: metodo === "cartao" ? parseInt(totalParcelas) : null,
            loja, comprovante_url: receiptPath || null,
          })
          .eq("id", editItem.id);
        if (error) throw error;

        // Propagate common fields to future installments in the same group
        if (editItem.parcela_grupo_id && editItem.parcela_atual) {
          const { error: errFuture } = await supabase
            .from("lancamentos")
            .update({
              categoria, loja,
              cartao_id: metodo === "cartao" ? cartaoId || null : null,
              metodo, fixo,
            })
            .eq("parcela_grupo_id", editItem.parcela_grupo_id)
            .gt("parcela_atual", editItem.parcela_atual);
          if (errFuture) throw errFuture;
        }
      } else if (metodo === "cartao" && parseInt(totalParcelas) > 1) {
        const grupoId = crypto.randomUUID();
        const parcelas = parseInt(totalParcelas);
        const valorParcela = +(valorNum / parcelas).toFixed(2);
        const baseDate = new Date(data + "T00:00:00");

        const inserts = Array.from({ length: parcelas }, (_, i) => {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          return {
            user_id: user.id, tipo, descricao: `${descricao} (${i + 1}/${parcelas})`,
            valor: valorParcela, data: d.toISOString().split("T")[0], categoria, fixo: false,
            metodo: "cartao", cartao_id: cartaoId || null,
            parcela_atual: i + 1, total_parcelas: parcelas,
            parcela_grupo_id: grupoId, loja,
          };
        });

        const { error } = await supabase.from("lancamentos").insert(inserts);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lancamentos").insert({
          user_id: user.id, tipo, descricao, valor: valorNum, data, categoria,
          fixo, metodo, cartao_id: metodo === "cartao" ? cartaoId || null : null, loja,
          comprovante_url: receiptPath || null,
        });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast({ title: editItem ? "Lançamento atualizado!" : "Lançamento adicionado!" });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;
    setLoading(true);
    try {
      if (editItem.parcela_grupo_id && editItem.parcela_atual) {
        // Delete this installment and all future ones in the same group
        const { error } = await supabase
          .from("lancamentos")
          .delete()
          .eq("parcela_grupo_id", editItem.parcela_grupo_id)
          .gte("parcela_atual", editItem.parcela_atual);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lancamentos").delete().eq("id", editItem.id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast({ title: "Excluído!" });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Importar notificação do banco */}
          {!editItem && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="flex w-full items-center justify-between rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  📱 Importar notificação do banco
                </span>
                {showNotifPanel ? <X className="h-4 w-4" /> : null}
              </button>
              {showNotifPanel && (
                <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Cole o texto da notificação do seu banco aqui (SMS, WhatsApp, push). O app vai extrair o valor e o estabelecimento.
                  </p>
                  <Textarea
                    placeholder="Ex: Nubank: Compra aprovada de R$ 89,90 em FARMÁCIA DROGASIL..."
                    value={notifText}
                    onChange={(e) => setNotifText(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                  <Button type="button" size="sm" onClick={handleImportNotif} disabled={!notifText.trim()}>
                    Importar dados
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tipo toggle */}
          <div className="flex gap-2">
            <Button type="button" variant={tipo === "receita" ? "default" : "outline"}
              className={cn("flex-1", tipo === "receita" && "bg-success hover:bg-success/90")}
              onClick={() => setTipo("receita")}>
              Receita
            </Button>
            <Button type="button" variant={tipo === "despesa" ? "default" : "outline"}
              className={cn("flex-1", tipo === "despesa" && "bg-destructive hover:bg-destructive/90")}
              onClick={() => setTipo("despesa")}>
              Despesa
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={valor}
                onChange={(e) => setValor(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
          </div>

          {/* Categorias grid */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIAS.map((cat) => (
                <button key={cat.id} type="button"
                  onClick={() => setCategoria(cat.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition-all",
                    categoria === cat.id
                      ? "bg-primary/10 text-primary ring-1 ring-primary"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}>
                  <cat.icon className="h-4 w-4" />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
            <Label>Fixo (mensal)</Label>
            <Switch checked={fixo} onCheckedChange={setFixo} />
          </div>

          {tipo === "despesa" && (
            <>
              <div className="flex gap-2">
                <Button type="button" variant={metodo === "avista" ? "default" : "outline"}
                  className="flex-1" onClick={() => setMetodo("avista")}>À Vista</Button>
                <Button type="button" variant={metodo === "cartao" ? "default" : "outline"}
                  className="flex-1" onClick={() => setMetodo("cartao")}>Cartão</Button>
              </div>

              {metodo === "cartao" && (
                <div className="space-y-3">
                  <Select value={cartaoId} onValueChange={setCartaoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cartão" /></SelectTrigger>
                    <SelectContent>
                      {cartoes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.instituicao} •••• {c.final_cartao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Input type="number" min="1" max="48" value={totalParcelas}
                      onChange={(e) => setTotalParcelas(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label>Loja (opcional)</Label>
            <div className="flex items-center gap-2">
              {loja && <LogoImage name={loja} size="sm" />}
              <Input value={loja} onChange={(e) => setLoja(e.target.value)} className="flex-1" />
            </div>
          </div>

          {/* SEÇÃO DE COMPROVANTE */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3 text-sm">📎 Comprovante</h3>
            {receiptPath ? (
              <ReceiptViewer
                filePath={receiptPath}
                fileName={receiptFileName || 'Comprovante'}
                onRemove={() => { setReceiptPath(''); setReceiptFileName(''); }}
              />
            ) : (
              <ReceiptUploadButton
                onUploadSuccess={(path, fileName) => {
                  setReceiptPath(path);
                  setReceiptFileName(fileName);
                }}
              />
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {editItem && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                {editItem.parcela_grupo_id && editItem.parcela_atual
                  ? `Excluir (${editItem.parcela_atual}/${editItem.total_parcelas} em diante)`
                  : "Excluir"}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : editItem ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
          {editItem?.parcela_grupo_id && editItem.parcela_atual && (
            <p className="text-xs text-muted-foreground text-center -mt-1">
              ℹ️ Campos comuns (categoria, loja, cartão, método) serão aplicados às parcelas seguintes.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoLancamentoModal;
