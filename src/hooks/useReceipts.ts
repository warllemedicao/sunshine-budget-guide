import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useReceipts = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadReceipt = async (file: File, userId: string): Promise<string | null> => {
    setLoading(true);
    try {
      const nameParts = file.name.split('.');
      const ext = nameParts.length > 1 ? nameParts.pop() : 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('comprovantes')
        .upload(path, file);
      if (error) throw error;
      toast({ title: 'Comprovante enviado!' });
      return data.path;
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getReceiptUrl = useCallback(async (path: string): Promise<string> => {
    const { data } = await supabase.storage
      .from('comprovantes')
      .createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  }, []);

  return { uploadReceipt, getReceiptUrl, loading };
};
