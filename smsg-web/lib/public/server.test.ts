import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  vi.unstubAllEnvs();
  fetchMock.mockReset();
});

describe("public loaders when the API is down", () => {
  it("fall back during the production build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { getServices, getSiteSettings } = await import("./server");
    expect(await getServices()).toEqual([]);
    expect((await getSiteSettings()).phone).toBeNull();
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect(await getServices()).toEqual([]);
  });
  it("throw at runtime", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { getServices } = await import("./server");
    await expect(getServices()).rejects.toThrow();
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(getServices()).rejects.toThrow("failed");
  });
});
