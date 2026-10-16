import { z } from 'zod';

const r = z
  .object({ SUPERADMIN_EMAIL: z.email(), SUPERADMIN_PASSWORD: z.string().min(12) })
  .safeParse(process.env);
if (!r.success) {
  console.error('Missing or invalid: ' + r.error.issues.map((i) => i.path.join('.')).join(', '));
  process.exit(1);
}
console.log('Super admin creation: available in phase 2.');
