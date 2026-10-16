import { afterAll, describe, expect, it } from 'vitest';
import { PERMISSIONS, type Action } from '../../src/auth/permissions';
import { specs } from './rls.matrix';
import { ID, ROLES, actAs, fixtures, rank, rolledBack, sql } from './helpers';

type Op = 'S' | 'I' | 'U' | 'D';
// Permissions backed directly by a table policy. Each must equal the minimum role of every listed
// [table, op] in the RLS matrix. Function-backed or ownership-scoped actions are covered elsewhere.
const BACKING: Partial<Record<Action, [string, Op][]>> = {
  'services.read_public': [['services', 'S']],
  'posts.read_public': [['posts', 'S']],
  'site_settings.read': [['site_settings', 'S']],
  'bookings.read': [['bookings', 'S']],
  'bookings.write': [
    ['bookings', 'I'],
    ['bookings', 'U'],
  ],
  'bookings.change_status': [['bookings', 'U']],
  'clients.read': [['clients', 'S']],
  'clients.write': [
    ['clients', 'I'],
    ['clients', 'U'],
  ],
  'members.read': [['members', 'S']],
  'members.write': [['members', 'U']],
  'members.end': [['members', 'U']],
  'membership_fees.write': [
    ['membership_fees', 'I'],
    ['membership_fees', 'U'],
  ],
  'invoices.read': [['invoices', 'S']],
  'invoices.mark_paid': [['invoices', 'U']],
  'services.write': [
    ['services', 'I'],
    ['services', 'U'],
    ['services', 'D'],
  ],
  'site_settings.write': [['site_settings', 'U']],
  'posts.write': [
    ['posts', 'I'],
    ['posts', 'U'],
  ],
  'posts.delete': [['posts', 'D']],
  'proposals.read': [['post_proposals', 'S']],
  'proposals.moderate': [['post_proposals', 'U']],
  'media.upload': [['media', 'I']],
  'media.delete': [['media', 'D']],
  'shifts.write': [
    ['shifts', 'I'],
    ['shifts', 'U'],
    ['shifts', 'D'],
  ],
  'shifts.assign': [
    ['shift_assignments', 'I'],
    ['shift_assignments', 'U'],
    ['shift_assignments', 'D'],
  ],
  'transports.read': [['transports', 'S']],
  'transports.write': [
    ['transports', 'I'],
    ['transports', 'U'],
  ],
  'transports.assign': [['transports', 'U']],
  'volunteers.write': [
    ['volunteers', 'I'],
    ['volunteers', 'U'],
  ],
  'vehicles.read': [['vehicles', 'S']],
  'vehicles.write': [
    ['vehicles', 'I'],
    ['vehicles', 'U'],
    ['vehicles', 'D'],
  ],
  'users.change_role': [
    ['user_roles', 'I'],
    ['user_roles', 'U'],
    ['user_roles', 'D'],
  ],
  'org_settings.write': [['org_settings', 'U']],
  'audit.read': [['audit_log', 'S']],
};

afterAll(() => sql.end());

describe('permissions.ts mirrors the RLS matrix', () => {
  for (const [action, backing] of Object.entries(BACKING) as [Action, [string, Op][]][]) {
    for (const [table, op] of backing) {
      it(`${action} == ${table}.${op}`, () => {
        const min = specs[table]?.[op]?.[0];
        expect(typeof min, `${table}.${op} must have a role minimum`).toBe('string');
        expect(PERMISSIONS[action]).toBe(min);
      });
    }
  }
});

// users.read is ownership-scoped in the matrix (volunteers see their own row), so check other users' rows here.
describe('users.read mirrors RLS on profiles and user_roles', () => {
  for (const role of ROLES.filter((r) => r !== 'anon')) {
    it(`${role} ${rank(role) >= rank(PERMISSIONS['users.read']) ? 'sees' : 'does not see'} other users`, async () => {
      await rolledBack(async (tx) => {
        await fixtures(tx);
        await actAs(tx, role);
        const visible = rank(role) >= rank(PERMISSIONS['users.read']) ? 1 : 0;
        expect(await tx.unsafe(`select 1 from profiles where id = '${ID.vol2}'`)).toHaveLength(
          visible,
        );
        expect(
          await tx.unsafe(`select 1 from user_roles where user_id = '${ID.vol2}'`),
        ).toHaveLength(visible);
      });
    });
  }
});
