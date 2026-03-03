import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchBrandfetchDomain, clearBrandfetchCache } from "@/lib/brandfetch";

describe("searchBrandfetchDomain", () => {
  beforeEach(() => {
    clearBrandfetchCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns null when VITE_BRANDFETCH_API_KEY is not set", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "");
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const result = await searchBrandfetchDomain("Amazon");

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns the first domain from the API response", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ domain: "amazon.com", name: "Amazon" }],
      }),
    );

    const result = await searchBrandfetchDomain("Amazon");

    expect(result).toBe("amazon.com");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.brandfetch.io/v2/search/Amazon",
      expect.objectContaining({ headers: { Authorization: "Bearer test-key" } }),
    );
  });

  it("caches results so the API is only called once per store name", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "test-key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ domain: "amazon.com" }],
    });
    vi.stubGlobal("fetch", mockFetch);

    const first = await searchBrandfetchDomain("Amazon");
    const second = await searchBrandfetchDomain("Amazon");

    expect(first).toBe("amazon.com");
    expect(second).toBe("amazon.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when the API returns an empty array", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );

    const result = await searchBrandfetchDomain("UnknownBrand");

    expect(result).toBeNull();
  });

  it("returns null when the API response is not ok", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await searchBrandfetchDomain("Amazon");

    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.stubEnv("VITE_BRANDFETCH_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );

    const result = await searchBrandfetchDomain("Amazon");

    expect(result).toBeNull();
  });
});
