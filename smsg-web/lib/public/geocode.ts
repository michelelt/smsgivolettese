// OpenStreetMap Nominatim: free, no key. Policy: identify the app, cache results, max 1 request/s.
const UA = "smsgivolettese-site (https://smsgivolettese.vercel.app)";

/** Address to coordinates; null when not found or the service is down (the page then shows only the map link). */
export async function geocode(
  address: string,
): Promise<{ lat: number; lon: number } | null> {
  const q = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    countrycodes: "it",
    q: address,
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const lat = Number(hit?.lat);
    const lon = Number(hit?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}

/** OpenStreetMap embed URL centred on the point, with a marker. */
export function osmEmbedUrl({ lat, lon }: { lat: number; lon: number }) {
  const d = 0.004;
  const bbox = [lon - d, lat - d / 2, lon + d, lat + d / 2].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}
