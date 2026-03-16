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
    setStorageProviderState(provider === 'google-drive' ? 'google-drive' : 'google-drive');
  }, []);

  const getGoogleProviderToken = useCallback(async (): Promise<string | null> => {
    const fromSession = (session as { provider_token?: string | null } | null)?.provider_token;
    if (fromSession) return fromSession;

    const { data } = await supabase.auth.getSession();
    const latestSession = data.session as { provider_token?: string | null } | null;
    if (latestSession?.provider_token) return latestSession.provider_token;

    // On some auth refresh cycles, provider_token can be absent in memory.
    await supabase.auth.refreshSession().catch(() => {});

    const { data: refreshed } = await supabase.auth.getSession();
    const refreshedSession = refreshed.session as { provider_token?: string | null } | null;
    return refreshedSession?.provider_token ?? null;
  }, [session]);

  /**
   * Uploads a file to Supabase Storage as a fallback when Google Drive is
   * unavailable (expired token, non-Google login, or shared from a bank/other app).
   * Files are stored under {userId}/{timestamp}_{random}.{ext} to satisfy the
   * bucket RLS policy.
   */
  const uploadToSupabaseFallback = useCallback(async (file: File, userId: string): Promise<string | null> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `${userId}/${safeName}`;
    const { error } = await supabase.storage
      .from('comprovantes')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    return path;
  }, []);

  const uploadReceipt = async (file: File, userId: string): Promise<string | null> => {
    setLoading(true);
    try {
      const providers = Array.isArray(user?.app_metadata?.providers)
        ? (user?.app_metadata?.providers as string[])
        : [];
      const hasGoogleProvider =
        user?.app_metadata?.provider === 'google' || providers.includes('google');

      const optimizedFile = await compressImageForUpload(file);

      // ── Try Google Drive first (only when authenticated with Google) ─────────
      if (hasGoogleProvider) {
        const providerToken = await getGoogleProviderToken();
        if (providerToken) {
          try {
            const driveFile = await uploadFileToGoogleDrive(optimizedFile, providerToken);
            if (driveFile?.id) {
              toast({ title: 'Comprovante enviado para o Google Drive!' });
              return toGoogleDrivePath(driveFile.id);
            }
          } catch (driveErr) {
            const errMsg = driveErr instanceof Error ? driveErr.message : String(driveErr);
            // 401/403 = expired/revoked token → fall through to Supabase fallback.
            // Any other error (network, 5xx) → also fall through so the user does
            // not lose the shared file.
            console.warn('[useReceipts] Google Drive upload falhou, usando Supabase como fallback:', errMsg);
          }
        }
        // provider_token absent (expired session, fresh login without Drive scope)
        // → fall through to Supabase silently.
      }

      // ── Fallback: Supabase Storage ───────────────────────────────────────────
      // Handles: non-Google users, expired Google token, and files shared from
      // any app (bank PDFs, WhatsApp, etc.) regardless of Google auth state.
      const supabasePath = await uploadToSupabaseFallback(optimizedFile, userId);
      if (supabasePath) {
        toast({ title: 'Comprovante salvo!' });
        return supabasePath;
      }

      return null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro inesperado';
      toast({ title: 'Erro ao salvar comprovante', description: message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getReceiptUrl = useCallback(async (path: string): Promise<string> => {
    if (isGoogleDrivePath(path)) {
      return getGoogleDriveFileViewUrl(path);
    }
    // Compatibility: older receipts stored as full URLs or Supabase paths.
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
