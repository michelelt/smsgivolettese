import { AddressBlock } from "@/components/public/page-bodies";
import { geocode, osmEmbedUrl } from "@/lib/public/geocode";

/** Address, embedded OpenStreetMap map (when the address is found) and the link to the full map. */
export async function AddressMap({ address }: { address: string }) {
  const point = await geocode(address);
  return (
    <div className="space-y-4">
      <AddressBlock address={address} mapQuery={address} />
      {point && (
        <iframe
          src={osmEmbedUrl(point)}
          title={`Mappa: ${address}`}
          loading="lazy"
          // Touch screens: the map ignores fingers so dragging scrolls the page; "Apri la mappa" gives the full map.
          className="block h-80 w-full rounded-2xl border-2 border-ink pointer-coarse:pointer-events-none sm:h-96"
        />
      )}
    </div>
  );
}
