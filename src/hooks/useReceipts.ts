import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  compressImageForUpload,
  getGoogleDriveFileViewUrl,
  isGoogleDrivePath,
  toGoogleDrivePath,
  type ReceiptStorageProvider,
  uploadFileToGoogleDrive,
} from '@/lib/googleDrive';

export const useReceipts = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [storageProvider, setStorageProviderState] = useState<ReceiptStorageProvider>('google-drive');

  useEffect(() => {
    setStorageProviderState('google-drive');
  }, []);

  const setStorageProvider = useCallback((provider: ReceiptStorageProvider) => {
    // Upload de comprovantes e sempre Google Drive para evitar consumo no Supabase.
    setStorageProviderState(provider === 'google-drive' ? 'google-drive' : 'google-drive');
  }, []);

  const getGoogleProviderToken = useCallback(async (): Promise<string | null> => {
    const fromSession = (session as { provider_token?: string | null } | null)?.provider_token;
    if (fromSession) return fromSession;

    const { data } = await supabase.auth.getSession();
    const latestSession = data.session as { provider_token?: string | null } | null;
    if (latestSession?.provider_token) return latestSession.provider_token;

    // On some auth refresh cycles, provider_token can be absent in memory.
    await supabase.auth.refreshSession().catch(() => {
      // If refresh fails, caller handles fallback UX.
    });

    const { data: refreshed } = await supabase.auth.getSession();
    const refreshedSession = refreshed.session as { provider_token?: string | null } | null;
    return refreshedSession?.provider_token ?? null;
  }, [session]);

  const uploadReceipt = async (file: File, _userId: string): Promise<string | null> => {
    setLoading(true);
    try {
      const providers = Array.isArray(user?.app_metadata?.providers)
        ? (user?.app_metadata?.providers as string[])
        : [];
      const hasGoogleProvider = user?.app_metadata?.provider === 'google' || providers.includes('google');

      if (!hasGoogleProvider) {
        toast({
          title: 'Google Drive requer login Google',
          description: 'Entre com sua conta Google para enviar comprovantes.',
          variant: 'destructive',
        });
        return null;
      }

      const providerToken = await getGoogleProviderToken();
      if (!providerToken) {
        toast({
          title: 'Token do Google indisponivel',
          description: 'Reautentique com Google para continuar.',
          variant: 'destructive',
        });
        return null;
      }

      const optimizedFile = await compressImageForUpload(file);
      const driveFile = await uploadFileToGoogleDrive(optimizedFile, providerToken);
      if (driveFile?.id) {
        toast({ title: 'Comprovante enviado para o Google Drive!' });
        return toGoogleDrivePath(driveFile.id);
      }
      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getReceiptUrl = useCallback(async (path: string): Promise<string> => {
    if (isGoogleDrivePath(path)) {
      return getGoogleDriveFileViewUrl(path);
    }
    // Compatibilidade com comprovantes antigos salvos no Supabase.
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const { data } = await supabase.storage
      .from('comprovantes')
      .createSignedUrl(path, 3600);
    return data?.signedUrl || '';
  }, []);

  return { uploadReceipt, getReceiptUrl, loading, storageProvider, setStorageProvider };
};
