/** Today as YYYY-MM-DD in Rome time (what the API uses). */
export const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

/** YYYY-MM-DD -> dd/mm/yyyy */
export const fmtDate = (d: string | null | undefined) =>
  d ? d.split("-").reverse().join("/") : "—";

export const currentYear = () => Number(today().slice(0, 4));
