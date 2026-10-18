import { hasRole } from "@/lib/auth/roles";
import { MyCommitments } from "@/components/gestione/my-commitments";
import { PageHeader } from "@/components/ui/actions";
import { StaffHome, StaffNewActions } from "./staff-home";
import { getSessionRole } from "@/lib/supabase/server";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ negato?: string }>;
}) {
  const { role } = await getSessionRole();
  const { negato } = await searchParams;
  const staff = hasRole(role, "staff");
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
      <PageHeader
        title={
          role === "volontario" ? "I miei impegni" : "Pannello di gestione"
        }
        actions={staff ? <StaffNewActions /> : undefined}
      />
      {staff ? <StaffHome /> : <MyCommitments />}
    </>
  );
}
