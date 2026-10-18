import { ActionBar } from "@/components/ui/actions";
import { ButtonLink } from "@/components/ui/button";
import { ShiftKpis } from "./shift-kpis";

/** "Nuovo ..." actions, rendered in the page header. */
export function StaffNewActions() {
  return (
    <>
      <ButtonLink href="/gestione/trasporti/nuovo">Nuovo trasporto</ButtonLink>
      <ButtonLink variant="secondary" href="/gestione/soci/nuovo">
        Nuovo socio
      </ButtonLink>
    </>
  );
}

export function StaffHome() {
  return (
    <>
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
