import { ValidationError } from './errors.js';

/** Current year in Europe/Rome (same clock the SQL functions use). */
export const romeYear = () =>
  Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(
      new Date(),
    ),
  );

/** Throws a clear 400 when a payment date is in the future (Europe/Rome) or before `notBefore`. */
export function assertPaidOn(paidOn: string | undefined | null, notBefore?: string) {
  if (!paidOn) return;
  if (paidOn > romeToday()) throw new ValidationError('La data di pagamento non può essere futura');
  if (notBefore && paidOn < notBefore)
    throw new ValidationError('La data di pagamento non può precedere la data di emissione');
}

/** Today as YYYY-MM-DD in Europe/Rome. */
export const romeToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
