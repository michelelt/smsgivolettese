import { z } from 'zod';
import { db } from '../src/lib/db.js';
import { supabaseAdmin } from '../src/lib/supabase-admin.js';

// Idempotent (ADR-027). Never touches the password of an existing user. No trigger on auth.users:
// profile + role rows are created here. Credentials are never printed.
const r = z
  .object({ SUPERADMIN_EMAIL: z.email(), SUPERADMIN_PASSWORD: z.string().min(12) })
  .safeParse(process.env);
if (!r.success) {
  console.error('Missing or invalid: ' + r.error.issues.map((i) => i.path.join('.')).join(', '));
  process.exit(1);
}
const email = r.data.SUPERADMIN_EMAIL.toLowerCase();
const admin = supabaseAdmin();

// shortcut: first 1000 users only, enough for this association; upgrade if the user count grows.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr)
  throw new Error(
    `Cannot list auth users (is Supabase running? start 'make dev' first): ${listErr.message}`,
  );
let user = list.users.find((u) => u.email?.toLowerCase() === email);
let created = false;
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: r.data.SUPERADMIN_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error('Cannot create auth user');
  user = data.user;
  created = true;
}

await db.asService(async (tx) => {
  await tx`insert into profiles (id, first_name, last_name, email)
           values (${user.id}, 'Super', 'Admin', ${email}) on conflict (id) do nothing`;
  await tx`insert into user_roles (user_id, role) values (${user.id}, 'super_admin')
           on conflict (user_id) do update set role = 'super_admin'`;
});
await db.end();
console.log(created ? 'Super admin created.' : 'Super admin already present, password untouched.');
