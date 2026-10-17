import { ActionBar } from "@/components/ui/actions";
import { ButtonLink } from "@/components/ui/button";
import { BookingKpis } from "./booking-kpis";
import { ShiftKpis } from "./shift-kpis";

/** "Nuovo ..." actions, rendered in the page header. */
export function StaffNewActions() {
  return (
    <>
      <ButtonLink href="/gestione/prenotazioni?nuova=1">
        Nuova prenotazione
      </ButtonLink>
      <ButtonLink variant="secondary" href="/gestione/soci/nuovo">
        Nuovo socio
      </ButtonLink>
    </>
  );
}

export function StaffHome() {
  return (
    <>
      <BookingKpis />
      <ShiftKpis />
      <ActionBar label="Vai a">
        <ButtonLink variant="secondary" href="/gestione/turni">
          Turni
        </ButtonLink>
        <ButtonLink variant="secondary" href="/gestione/trasporti">
          Trasporti
        </ButtonLink>
      </ActionBar>
    </>
  );
}
