/** 123450 -> "1234,50" (CSV, no thousands separator). */
export const centsToDecimal = (cents: number) =>
  `${cents < 0 ? '-' : ''}${Math.trunc(Math.abs(cents) / 100)},${String(Math.abs(cents) % 100).padStart(2, '0')}`;

/** 123450 -> "1.234,50 €" (documents). */
export const formatEuro = (cents: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
