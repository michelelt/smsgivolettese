import { notFound } from "next/navigation";
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
      <h1 className="text-4xl font-extrabold text-bordeaux">{s.label}</h1>
      <p className="mt-4">Questa pagina è in costruzione.</p>
    </>
  );
}
