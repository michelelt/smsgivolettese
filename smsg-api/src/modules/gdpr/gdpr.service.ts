import { asUser, type Ctx } from '../../lib/ctx.js';
import { romeToday } from '../../lib/dates.js';
import { BadGateway } from '../../lib/errors.js';
import { log } from '../../lib/logger.js';
import { supabaseAdmin } from '../../lib/supabase-admin.js';
import * as repo from './gdpr.repo.js';
import type { AnonymizeBody } from './gdpr.schemas.js';

export async function exportData(ctx: Ctx, subject: 'member' | 'user', id: string) {
  const data = await asUser(ctx, (tx) => repo.exportData(tx, subject, id));
  const m = (data.member ?? {}) as { cardNumber?: number; card_number?: number };
  const card = m.cardNumber ?? m.card_number;
  const filename =
    subject === 'member'
      ? `dati-socio-${card ?? id}-${romeToday()}.json`
      : `dati-utente-${romeToday()}.json`;
  return { body: JSON.stringify(data, null, 2), filename };
}

export async function anonymize(ctx: Ctx, { subject, id }: AnonymizeBody) {
  const out = (await asUser(ctx, (tx) => repo.anonymize(tx, subject, id))) as {
    retainedInvoices?: { id: string; year: number; number: number }[];
  };
  if (subject === 'user') {
    // After commit; idempotent, so a failed call is simply retried (ADR-067).
    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, {
      email: `deleted+${id}@invalid.local`,
      email_confirm: true,
      ban_duration: '876000h',
      user_metadata: {},
    });
    if (error) {
      log('error', 'anonymise auth sync failed', { status: error.status });
      throw new BadGateway(
        "Dati anonimizzati, ma l'accesso dell'utente non è stato aggiornato: riprova",
        'AUTH_SYNC_FAILED',
      );
    }
  }
  return { retainedInvoices: out.retainedInvoices ?? [] };
}
