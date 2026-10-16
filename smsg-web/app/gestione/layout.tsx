import Link from "next/link";
import { redirect } from "next/navigation";
import { hasRole, SECTIONS } from "@/lib/auth/roles";
import { Providers } from "./providers";
import { NavLink } from "./nav-link";
import { getSessionRole } from "@/lib/supabase/server";

export default async function GestioneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = await getSessionRole();
  if (!role) redirect("/accedi?next=/gestione"); // defence in depth behind proxy.ts
  const items = SECTIONS.filter((s) => hasRole(role, s.min));
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/gestione"
          className="text-2xl font-extrabold text-bordeaux"
        >
          SMS Givolettese — Gestione
        </Link>
        <form action="/auth/esci" method="post">
          <button className="min-h-12 rounded-xl border-2 border-blu px-5 text-lg font-bold text-blu">
            Esci
          </button>
        </form>
      </header>
      <nav aria-label="Sezioni di gestione" className="mt-4">
        <ul className="flex flex-wrap gap-3">
          {items.map((s) => (
            <li key={s.slug}>
              <NavLink href={`/gestione/${s.slug}`}>{s.label}</NavLink>
            </li>
          ))}
          <li>
            <NavLink href="/gestione/account/password">Cambia password</NavLink>
          </li>
        </ul>
      </nav>
      <main className="mt-6">
        <Providers>{children}</Providers>
      </main>
    </div>
  );
}
