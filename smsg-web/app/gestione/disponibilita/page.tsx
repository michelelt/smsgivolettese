import { PageHeader } from "@/components/ui/actions";
import { MyAvailability } from "@/components/gestione/my-availability";
import { StaffAvailability } from "@/components/gestione/staff-availability";
import { hasRole } from "@/lib/auth/roles";
import { getSessionRole } from "@/lib/supabase/server";

export default async function Disponibilita() {
  const { role } = await getSessionRole();
  const staff = hasRole(role, "staff");
  return (
    <>
      <PageHeader
        title={staff ? "Disponibilità dei volontari" : "Le mie disponibilità"}
      />
      {staff ? <StaffAvailability /> : <MyAvailability />}
    </>
  );
}
