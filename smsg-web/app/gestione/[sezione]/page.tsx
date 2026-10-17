import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/actions";
import { SECTIONS } from "@/lib/auth/roles";

export default async function Sezione({
  params,
}: {
  params: Promise<{ sezione: string }>;
}) {
  const { sezione } = await params;
  const s = SECTIONS.find((x) => x.slug === sezione);
  if (!s) notFound();
  return (
    <>
      <PageHeader title={s.label} />
      <p className="mt-4">Questa pagina è in costruzione.</p>
    </>
  );
}
