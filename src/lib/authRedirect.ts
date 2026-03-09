const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const isGithubDevHost = (hostname: string): boolean =>
  hostname.endsWith(".github.dev") || hostname.endsWith(".app.github.dev");

const getHostnameFromUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

/**
 * Returns the auth redirect URL used by Supabase OAuth/password recovery flows.
 * Priority:
 * 1) VITE_AUTH_REDIRECT_URL_NATIVE when on native runtime
 * 2) VITE_AUTH_REDIRECT_URL_WEB when on web runtime
 * 3) VITE_AUTH_REDIRECT_URL (legacy fallback)
 * 4) current window origin when not localhost
 */
export const getAuthRedirectUrl = (): string | undefined => {
  const nativeConfigured = import.meta.env.VITE_AUTH_REDIRECT_URL_NATIVE?.trim();
  const webConfigured = import.meta.env.VITE_AUTH_REDIRECT_URL_WEB?.trim();
  const fallbackConfigured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

  const maybeCapacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const isNativeRuntime = typeof maybeCapacitor?.isNativePlatform === "function"
    ? !!maybeCapacitor.isNativePlatform()
    : false;

  if (isNativeRuntime && nativeConfigured) return nativeConfigured;

  const { hostname, origin } = window.location;

  if (isGithubDevHost(hostname)) {
    // Codespaces URLs change often; always return the current tab origin.
    return origin;
  }

  if (!isNativeRuntime && webConfigured) {
    const configuredHost = getHostnameFromUrl(webConfigured);
    // On localhost dev, prefer configured public web URL when available.
    if (LOCAL_HOSTS.has(hostname)) {
      return webConfigured;
    }

    // Ignore stale github.dev URLs committed in env files when already on a github.dev host.
    if (!configuredHost || !isGithubDevHost(configuredHost) || configuredHost === hostname) {
      return webConfigured;
    }
  }

  if (fallbackConfigured) return fallbackConfigured;

  if (LOCAL_HOSTS.has(hostname)) {
    // Avoid returning localhost in native/webview contexts.
    return undefined;
  }
  return origin;
};
