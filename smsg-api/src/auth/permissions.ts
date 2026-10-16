// Single source of truth for permissions (docs/permissions.md). Mirrored by RLS: change both together.
// Parity with the RLS matrix is enforced by test/db/permissions.parity.test.ts.
export const ROLES = ['volontario', 'staff', 'super_admin'] as const; // enum order = hierarchy
export type AppRole = (typeof ROLES)[number];
export type MinRole = 'anon' | AppRole;

const A = 'anon' as const;
const V = 'volontario' as const;
const S = 'staff' as const;
const SA = 'super_admin' as const;

export const PERMISSIONS = {
  'services.read_public': A,
  'posts.read_public': A,
  'site_settings.read': A,
  'bookings.submit_public': A,
  'proposals.submit_public': A,
  'me.read': V,
  'profile.write_own': V,
  'availability.read_own': V,
  'availability.write_own': V,
  'shift_assignments.read_own': V,
  'shift_assignments.respond_own': V,
  'transports.read_own': V,
  'transports.respond_own': V,
  'transports.complete_own': V,
  'volunteers.read_own': V,
  'bookings.read': S,
  'bookings.write': S,
  'bookings.change_status': S,
  'clients.read': S,
  'clients.write': S,
  'members.read': S,
  'members.write': S,
  'members.end': S,
  'members.export': S,
  'membership_fees.write': S,
  'invoices.read': S,
  'invoices.issue': S,
  'invoices.mark_paid': S,
  'invoices.void': S,
  'invoices.export': S,
  'services.write': S,
  'site_settings.write': S,
  'posts.read_drafts': S,
  'posts.write': S,
  'posts.publish': S,
  'posts.delete': S,
  'proposals.read': S,
  'proposals.moderate': S,
  'media.upload': S,
  'media.delete': S,
  'shifts.read': S,
  'shifts.write': S,
  'shifts.assign': S,
  'transports.read': S,
  'transports.write': S,
  'transports.assign': S,
  'transports.export': S,
  'volunteers.read': S,
  'volunteers.write': S,
  'vehicles.read': S,
  'vehicles.write': S,
  'availability.read_all': S,
  'users.invite_volunteer': S,
  'availability.write_all': SA,
  'users.read': SA,
  'users.invite_staff': SA,
  'users.change_role': SA,
  'users.deactivate': SA,
  'org_settings.write': SA,
  'counters.write': SA,
  'audit.read': SA,
  'gdpr.export': SA,
  'gdpr.anonymize': SA,
} as const satisfies Record<string, MinRole>;

export type Action = keyof typeof PERMISSIONS;

export const isAppRole = (v: unknown): v is AppRole => ROLES.includes(v as AppRole);
export const rank = (r: MinRole | null) => (r === null || r === 'anon' ? 0 : ROLES.indexOf(r) + 1);
export const can = (role: AppRole | null, action: Action) =>
  rank(role) >= rank(PERMISSIONS[action]);
