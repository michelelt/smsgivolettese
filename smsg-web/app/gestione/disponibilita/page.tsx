import { MyAvailability } from "@/components/gestione/my-availability";
import { StaffAvailability } from "@/components/gestione/staff-availability";
import { hasRole } from "@/lib/auth/roles";
import { getSessionRole } from "@/lib/supabase/server";

export default async function Disponibilita() {
  const { role } = await getSessionRole();
  const staff = hasRole(role, "staff");
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">
        {staff ? "Disponibilità dei volontari" : "Le mie disponibilità"}
      </h1>
      {staff ? <StaffAvailability /> : <MyAvailability />}
    </>
  );
}
