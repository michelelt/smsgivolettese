import { afterEach, expect, test, vi } from "vitest";
import { geocode, osmEmbedUrl } from "./geocode";

afterEach(() => vi.unstubAllGlobals());

test("geocode returns the first hit as numbers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json([{ lat: "45.159", lon: "7.498" }])),
  );
  expect(await geocode("Via Sandro Pertini 15, Givoletto")).toEqual({
    lat: 45.159,
    lon: 7.498,
  });
});

test("geocode returns null on no hit or network error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json([])),
  );
  expect(await geocode("nowhere")).toBeNull();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("down");
    }),
  );
  expect(await geocode("x")).toBeNull();
});

test("osmEmbedUrl puts the marker on the point", () => {
  const u = new URL(osmEmbedUrl({ lat: 45, lon: 7 }));
  expect(u.searchParams.get("marker")).toBe("45,7");
  expect(u.searchParams.get("bbox")).toBe("6.996,44.998,7.004,45.002");
});
