import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_DRIVE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";

interface GoogleOAuthResult {
  error: Error | null;
}

export const startGoogleOAuth = async (redirectTo?: string): Promise<GoogleOAuthResult> => {
  const { Capacitor } = await import("@capacitor/core");
  const isNative = Capacitor.isNativePlatform();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: GOOGLE_DRIVE_SCOPES,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      ...(isNative ? { skipBrowserRedirect: true } : {}),
    },
  });

  if (error) {
    return { error };
  }

  if (isNative && data?.url) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url });
  }

  return { error: null };
};
