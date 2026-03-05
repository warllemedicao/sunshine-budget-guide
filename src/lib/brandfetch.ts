/**
 * In-memory cache so we never call the Search API twice for the same store name.
 * The empty string "" is used as a sentinel meaning "no domain found" so that
 * failed lookups are also cached and don't trigger repeated network requests.
 */
const domainCache = new Map<string, string>();

/** Clear the cache. Exposed for unit-testing purposes. */
export function clearBrandfetchCache(): void {
  domainCache.clear();
}

/**
 * Searches the Brandfetch API for a company by name and returns its primary domain.
 *
 * Requires VITE_BRANDFETCH_API_KEY to be set in the environment.
 * Returns null when the key is missing, the request fails, or no result is found.
 *
 * Results are cached in memory for the lifetime of the page so that repeated
 * renders of the same store name do not trigger extra network requests.
 */
export async function searchBrandfetchDomain(storeName: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_BRANDFETCH_API_KEY;
  if (!apiKey) return null;

  const cacheKey = storeName.toLowerCase().trim();
  const cached = domainCache.get(cacheKey);
  // Convert the "" sentinel back to null so callers receive a consistent type.
  if (cached !== undefined) return cached || null;

  try {
    const response = await fetch(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(storeName)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) {
      console.warn(
        `[Brandfetch] Search API returned ${response.status} for "${storeName}". ` +
        `Check that VITE_BRANDFETCH_API_KEY is valid and the request URL is correct.`,
      );
      return null;
    }

    const results: Array<{ domain?: string }> = await response.json();
    const domain = results?.[0]?.domain ?? null;
    // Always cache the result — including "not found" — to prevent duplicate
    // API calls for stores with no matching domain.
    domainCache.set(cacheKey, domain ?? "");
    if (!domain) {
      console.warn(`[Brandfetch] No domain found for "${storeName}" in API response.`);
    }
    return domain;
  } catch (err) {
    console.warn(`[Brandfetch] Network error while searching for "${storeName}":`, err);
    return null;
  }
}
