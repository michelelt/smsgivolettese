import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { eur } from "@/lib/public/booking";
import type { paths } from "@/lib/api/schema";

export type PublicService =
  paths["/public/services"]["get"]["responses"][200]["content"]["application/json"]["items"][number];

export function ServiceCard({ s }: { s: PublicService }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white p-5">
      <h3 className="text-2xl font-extrabold text-bordeaux">{s.name}</h3>
      {s.description && <p>{s.description}</p>}
      {s.scheduleNote && (
        <p className="flex items-start gap-2">
          <Icon name="clock" /> <span>{s.scheduleNote}</span>
        </p>
      )}
      <dl className="mt-auto grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-blu p-3">
          <dt>Soci</dt>
          <dd className="text-2xl font-extrabold">{eur(s.memberPriceCents)}</dd>
        </div>
        <div className="rounded-xl border-2 border-blu p-3">
          <dt>Non soci</dt>
          <dd className="text-2xl font-extrabold">
            {eur(s.nonMemberPriceCents)}
          </dd>
        </div>
      </dl>
      {s.bookable ? (
        <ButtonLink href={`/prenota?servizio=${s.id}`}>
          <Icon name="cal" />
          Prenota {s.name}
        </ButtonLink>
      ) : (
        <p className="font-bold">Per questo servizio ci telefoni.</p>
      )}
    </article>
  );
}
