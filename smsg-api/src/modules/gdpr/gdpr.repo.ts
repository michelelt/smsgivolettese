import type { Tx } from '../../lib/db.js';

type Json = Record<string, unknown>;

export const exportData = async (tx: Tx, subject: 'member' | 'user', id: string) =>
  (await tx<{ r: Json }[]>`select app.gdpr_export(${subject}, ${id}::uuid) as r`)[0]!.r;

export const anonymize = async (tx: Tx, subject: 'member' | 'user', id: string) => {
  const [row] =
    subject === 'member'
      ? await tx<{ r: Json }[]>`select app.anonymize_member(${id}::uuid) as r`
      : await tx<{ r: Json }[]>`select app.anonymize_user(${id}::uuid) as r`;
  return row!.r;
};
