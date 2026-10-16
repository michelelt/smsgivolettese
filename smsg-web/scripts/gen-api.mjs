// Cross-shell wrapper: OPENAPI_URL defaults to the exported contract file.
import { spawnSync } from "node:child_process";
const url = process.env.OPENAPI_URL ?? "../api/openapi.json";
const r = spawnSync(
  "pnpm",
  ["exec", "openapi-typescript", url, "-o", "lib/api/schema.d.ts"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(r.status ?? 1);
