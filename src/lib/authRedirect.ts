const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Returns the auth redirect URL used by Supabase OAuth/password recovery flows.
 * Priority:
 * 1) VITE_AUTH_REDIRECT_URL (recommended for APK/PWA consistency)
 * 2) current window origin when not localhost
 */
export const getAuthRedirectUrl = (): string | undefined => {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (configured) return configured;

  const { hostname, origin } = window.location;
  if (LOCAL_HOSTS.has(hostname)) {
    // Avoid returning localhost in native/webview contexts.
    return undefined;
  }
  return origin;
};
