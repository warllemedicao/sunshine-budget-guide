import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Receipt {
  id: string;
  transactionId: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export const useReceipts = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadReceipt = async (
    file: File,
    transactionId: string
  ): Promise<string | null> => {
    try {
      setLoading(true);
      const fileName = `${transactionId}_${Date.now()}_${file.name}`;
      
      // 1. Fazer upload do arquivo no Storage do Supabase
      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(`receipts/${fileName}`, file);

      if (error) throw error;

      // 2. Salvar a referência no banco de dados
      const { error: dbError } = await supabase
        .from('receipts')
        .insert({
          transaction_id: transactionId,
          file_name: file.name,
          file_path: data.path,
        });

      if (dbError) throw dbError;

      toast({ title: 'Comprovante salvo com sucesso!' });
      return data.path;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar comprovante', variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getReceiptUrl = async (filePath: string): Promise<string> => {
    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const deleteReceipt = async (receiptId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (error) throw error;
      toast({ title: 'Comprovante deletado' });
      return true;
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast({ title: 'Erro', description: 'Erro ao deletar comprovante', variant: 'destructive' });
      return false;
    }
  };

  const fetchReceiptsForTransaction = async (transactionId: string) => {
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('transaction_id', transactionId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar comprovantes:', error);
      return [];
    }
  };

  return {
    uploadReceipt,
    getReceiptUrl,
    deleteReceipt,
    fetchReceiptsForTransaction,
    loading,
  };
};