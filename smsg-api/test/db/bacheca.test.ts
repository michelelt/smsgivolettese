import { afterAll, describe, expect, it } from 'vitest';
import { actAs, attempt, fixtures, ID, rolledBack, sql } from './helpers';

afterAll(() => sql.end());
const PUB = 'ff000000-0000-4000-8000-000000000001';
const DRAFT = 'ff000000-0000-4000-8000-000000000002';
const PROP = 'ff100000-0000-4000-8000-000000000001';
const run = (stmt: string) =>
  rolledBack(async (tx) => {
    await fixtures(tx);
    const r = await attempt(tx, stmt);
    return r.ok ? 'OK' : `${r.code}:${r.message}`;
  });

describe('posts checks (ADR-062)', () => {
  const bad: [string, string][] = [
    [`update posts set content = '{}' where id = '${DRAFT}'`, 'posts_content_array_chk'],
    [`update posts set title = repeat('x', 201) where id = '${DRAFT}'`, 'posts_title_len_chk'],
    [
      `update posts set location = repeat('x', 201) where id = '${DRAFT}'`,
      'posts_location_len_chk',
    ],
    [`update posts set slug = repeat('a', 81) where id = '${DRAFT}'`, 'posts_slug_len_chk'],
    [
      `update posts set category = 'evento', status = 'pubblicata', published_at = now() where id = '${DRAFT}'`,
      'posts_event_date_chk',
    ],
  ];
  it.each(bad)('rejects %s', async (stmt, name) => {
    expect(await run(stmt)).toMatch(new RegExp(`^23514:.*${name}`));
  });
  it('accepts evento draft without date, published evento with date, 200-char title, 80-char slug', async () => {
    expect(await run(`update posts set category = 'evento' where id = '${DRAFT}'`)).toBe('OK');
    expect(
      await run(
        `update posts set category = 'evento', event_date = current_date, status = 'pubblicata', published_at = now() where id = '${DRAFT}'`,
      ),
    ).toBe('OK');
    expect(
      await run(
        `update posts set title = repeat('x', 200), slug = repeat('a', 80) where id = '${DRAFT}'`,
      ),
    ).toBe('OK');
  });
});

describe('slug freeze', () => {
  it('allows slug change on a never-published draft', async () => {
    expect(await run(`update posts set slug = 't-renamed' where id = '${DRAFT}'`)).toBe('OK');
  });
  it('raises SLUG_FROZEN once published, also after unpublish; same slug is fine', async () => {
    expect(await run(`update posts set slug = 't-new' where id = '${PUB}'`)).toMatch(/SLUG_FROZEN/);
    expect(await run(`update posts set slug = slug where id = '${PUB}'`)).toBe('OK');
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(`update posts set status = 'bozza' where id = '${PUB}'`);
      const [p] = await tx.unsafe(`select published_at from posts where id = '${PUB}'`);
      expect(p!.published_at).not.toBeNull();
      expect(
        await attempt(tx, `update posts set slug = 't-new' where id = '${PUB}'`),
      ).toMatchObject({
        ok: false,
        message: 'SLUG_FROZEN',
      });
    });
  });
});

describe('proposal <-> post links', () => {
  it('deleting either side nulls the other', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await tx.unsafe(
        `update posts set from_proposal_id = '${PROP}' where id = '${DRAFT}';
         update post_proposals set post_id = '${DRAFT}' where id = '${PROP}'`,
      );
      await tx.unsafe(`delete from posts where id = '${DRAFT}'`);
      const [p] = await tx.unsafe(`select post_id from post_proposals where id = '${PROP}'`);
      expect(p!.post_id).toBeNull();
      await tx.unsafe(`update posts set from_proposal_id = '${PROP}' where id = '${PUB}'`);
      await tx.unsafe(`delete from post_proposals where id = '${PROP}'`);
      const [q] = await tx.unsafe(`select from_proposal_id from posts where id = '${PUB}'`);
      expect(q!.from_proposal_id).toBeNull();
    });
  });
});

describe('audit and storage', () => {
  it('audits post writes and proposal reviews by staff, proposals without personal data', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      await actAs(tx, 'staff');
      await tx.unsafe(`update posts set title = 'changed' where id = '${DRAFT}'`);
      await tx.unsafe(`update post_proposals set status = 'rifiutata' where id = '${PROP}'`);
      await tx.unsafe('reset role');
      const rows = await tx.unsafe(
        `select table_name, actor_id, after ? 'submitter_name' as has_name, after ->> 'status' as status from audit_log
          where action = 'update' and ((table_name = 'posts' and row_id = '${DRAFT}') or (table_name = 'post_proposals' and row_id = '${PROP}'))
          order by table_name`,
      );
      expect(rows).toEqual([
        { table_name: 'post_proposals', actor_id: ID.staff, has_name: false, status: 'rifiutata' },
        { table_name: 'posts', actor_id: ID.staff, has_name: false, status: 'bozza' },
      ]);
    });
  });
  it('proposals bucket is capped at 5 MB, media at 50 MB', async () => {
    const rows =
      await sql`select id, file_size_limit from storage.buckets where id in ('media','proposals') order by id`;
    expect(rows.map((r) => Number(r.file_size_limit))).toEqual([52428800, 5242880]);
  });
});
