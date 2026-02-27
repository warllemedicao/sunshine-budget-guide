import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CATEGORIAS } from "@/lib/categories";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { ReceiptUploadButton } from '@/components/ReceiptUploadButton';
import { ReceiptViewer } from '@/components/ReceiptViewer';
import { useReceipts } from '@/hooks/useReceipts';
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
            loja,
          })
          .eq("id", editItem.id);
        if (error) throw error;
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
    const { error } = await supabase.from("lancamentos").delete().eq("id", editItem.id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast({ title: "Excluído!" });
      onOpenChange(false);
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
            <Input value={loja} onChange={(e) => setLoja(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            {editItem && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                Excluir
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Salvando..." : editItem ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NovoLancamentoModal;
