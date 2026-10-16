import { ButtonLink } from "@/components/ui/button";
import { BookingKpis } from "./booking-kpis";

export function StaffHome() {
  return (
    <>
      <BookingKpis />
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/gestione/prenotazioni?nuova=1">
          Nuova prenotazione
        </ButtonLink>
        <ButtonLink variant="secondary" href="/gestione/soci/nuovo">
          Nuovo socio
        </ButtonLink>
      </div>
    </>
  );
}
