import { afterAll, describe, expect, it } from 'vitest';
import { ID, actAs, fixtures, rolledBack, sql, sqlCode } from './helpers';

afterAll(() => sql.end());

const UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const ins = (extra: string, val: string) =>
  `insert into post_proposals (title, category, body, ${extra.includes('submitter_name') ? '' : 'submitter_name,'} ${extra}) values ('t','avviso','b', ${extra.includes('submitter_name') ? '' : "'n',"} ${val})`;

describe('post_proposals field checks', () => {
  const bad: [string, string, string][] = [
    ['video_url', "'http://x.test/v'", 'http video'],
    ['video_url', "'javascript:alert(1)'", 'js video'],
    ['video_url', "'https://x.test/a b'", 'space in video'],
    ['photo_path', "'../etc/passwd'", 'traversal photo'],
    ['photo_path', `'proposals/${UUID}.png'`, 'prefixed photo'],
    ['photo_path', `'${UUID}.exe'`, 'bad ext photo'],
    ['location', "repeat('x', 201)", 'long location'],
    ['submitter_contact', "repeat('x', 201)", 'long contact'],
    ['submitter_name', "repeat('x', 121)", 'long name'],
  ];
  it.each(bad)('rejects %s = %s (%s)', async (col, val) => {
    await rolledBack(async (tx) => {
      const r = await sqlCode(tx.savepoint((sp) => sp.unsafe(ins(col, val))));
      expect(r.code).toBe('23514');
    });
  });
  it('accepts valid values', async () => {
    await rolledBack(async (tx) => {
      await tx.unsafe(ins('photo_path, video_url', `'${UUID}.jpg', 'https://youtu.be/abc'`));
    });
  });
});

describe('volunteer_transports_v keeps svolto rows 30 days', () => {
  it('hides old svolto, shows recent', async () => {
    await rolledBack(async (tx) => {
      await fixtures(tx);
      const mk = (id: string, days: number) =>
        tx.unsafe(`insert into transports (id, member_id, travel_date, departure_at, from_address, to_address, odometer_start, odometer_end, driver_volunteer_id, status)
        values ('${id}','f7000000-0000-4000-8000-000000000001', current_date - ${days}, now() - interval '${days} days', 'a', 'b', 0, 1, '${ID.vol}', 'svolto')`);
      await mk('fc000000-0000-4000-8000-0000000000a1', 8);
      await mk('fc000000-0000-4000-8000-0000000000a2', 31);
      await actAs(tx, 'volontario');
      const rows =
        await tx`select id from volunteer_transports_v where status = 'svolto' and id::text like 'fc000000-0000-4000-8000-0000000000a%'`;
      expect(rows.map((r) => r.id)).toEqual(['fc000000-0000-4000-8000-0000000000a1']);
    });
  });
});
