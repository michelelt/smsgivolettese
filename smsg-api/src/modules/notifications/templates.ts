import { env } from '../../config/env.js';

/** What an email may say about a commitment (ADR-057): type, date, time. Never member data. */
export type Item = { label: string; day: string; time: string | null };

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const line = (i: Item) => `${i.label}, ${dmy(i.day)}${i.time ? `, ${i.time}` : ''}`;
const link = () => `${env.WEB_URL ?? 'http://localhost:3000'}/gestione`;
const wrap = (subject: string, body: string) => ({
  subject,
  text: `Buongiorno,\n\n${body}\n\nI dettagli sono nell'area riservata: ${link()}\n\nSMS Givolettese`,
});

export const assigned = (i: Item) =>
  wrap(
    'Nuovo impegno assegnato',
    `ti è stato assegnato un impegno:\n${line(i)}\nConferma o rifiuta dall'area riservata.`,
  );
export const modified = (i: Item) =>
  wrap(
    'Impegno modificato',
    `un tuo impegno è stato modificato:\n${line(i)}\nControlla i nuovi dettagli e conferma di nuovo.`,
  );
export const cancelled = (i: Item) =>
  wrap('Impegno annullato', `il seguente impegno è stato annullato:\n${line(i)}`);
export const reminder = (items: Item[]) =>
  wrap(
    'Promemoria impegni di domani',
    `domani hai ${items.length === 1 ? 'questo impegno' : 'questi impegni'}:\n${items.map(line).join('\n')}`,
  );
export const refused = (who: string, i: Item) =>
  wrap(
    'Impegno rifiutato',
    `${who} ha rifiutato questo impegno:\n${line(i)}\nServe una nuova assegnazione.`,
  );
