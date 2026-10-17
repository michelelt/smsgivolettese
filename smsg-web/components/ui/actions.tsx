import type { ReactNode } from "react";

/**
 * Button layout for /gestione pages. Use these instead of ad-hoc flex rows.
 *
 * Conventions (children are plain <Button>/<ButtonLink>, no `auto` needed):
 * - ONE primary button per page/bar, then secondary ones, in reading order.
 * - Destructive action goes in the `danger` slot: separated, right-aligned on
 *   desktop, last and full width on phone. Use variant="danger" for it.
 * - Phone: every button is full width and stacked (44px+ targets).
 *
 * <PageHeader title="Bacheca" actions={<ButtonLink href="...">Nuovo</ButtonLink>} />
 * <ActionBar label="Azioni sull'articolo" sticky danger={<Button variant="danger">Elimina</Button>}>
 *   <Button>Pubblica</Button>
 *   <Button variant="secondary">Salva la bozza</Button>
 * </ActionBar>
 */
const fit = "[&>*]:w-full! sm:[&>*]:w-auto!";

/** h1 on the left, page-level actions (e.g. "Nuovo ...") on the right; wraps on phone. */
export function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  /** Optional line under the title (status pill, subtitle). */
  children?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-extrabold text-bordeaux">{title}</h1>
        {actions && (
          <div
            className={`flex w-full flex-col gap-3 sm:w-auto sm:flex-row ${fit}`}
          >
            {actions}
          </div>
        )}
      </div>
      {children}
    </>
  );
}

/** Bottom-of-form / detail action bar. `sticky` pins it to the viewport bottom from sm up. */
export function ActionBar({
  label,
  sticky = false,
  danger,
  children,
}: {
  /** Accessible name of the group. */
  label: string;
  sticky?: boolean;
  danger?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`mt-6 flex flex-col gap-3 border-t-2 border-ink bg-paper py-3 sm:flex-row sm:flex-wrap sm:items-center ${fit} ${sticky ? "sm:sticky sm:bottom-0 sm:z-10" : ""}`}
    >
      {children}
      {danger && (
        <div className="mt-3 flex flex-col gap-3 border-t-2 border-ink pt-3 sm:ml-auto sm:mt-0 sm:flex-row sm:border-t-0 sm:pt-0 [&>*]:w-full! sm:[&>*]:w-auto!">
          {danger}
        </div>
      )}
    </div>
  );
}
