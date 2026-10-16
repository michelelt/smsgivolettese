import { hasRole } from "@/lib/auth/roles";
import { MyCommitments } from "@/components/gestione/my-commitments";
import { StaffHome } from "./staff-home";
import { getSessionRole } from "@/lib/supabase/server";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ negato?: string }>;
}) {
  const { role } = await getSessionRole();
  const { negato } = await searchParams;
  return (
    <>
      {negato && (
        <p
          role="alert"
          className="mb-4 rounded-xl border-2 border-bordeaux p-3 font-bold text-bordeaux"
        >
          Attenzione: non hai il permesso di aprire quella pagina.
        </p>
      )}
      <h1 className="text-4xl font-extrabold text-bordeaux">
        {role === "volontario" ? "I miei impegni" : "Pannello di gestione"}
      </h1>
      {hasRole(role, "staff") ? <StaffHome /> : <MyCommitments />}
    </>
  );
}
