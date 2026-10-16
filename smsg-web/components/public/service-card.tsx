import { Icon } from "@/components/ui/icon";
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
    </article>
  );
}
