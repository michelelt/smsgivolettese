import { createHash } from "node:crypto";
import { TEXT_SIZE_SCRIPT } from "./text-size";

const dev = process.env.NODE_ENV !== "production";
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const textSizeHash = `'sha256-${createHash("sha256").update(TEXT_SIZE_SCRIPT).digest("base64")}'`;

function build(scriptSrc: string, frames: string) {
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    `frame-src ${frames}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

// ADR-036: no hash or nonce here, it would disable 'unsafe-inline' and break Next's inline scripts.
export const publicCsp = () =>
  build(
    "'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "https://challenges.cloudflare.com",
  );

export const privateCsp = (nonce: string) =>
  build(`'self' 'nonce-${nonce}' ${textSizeHash}`, "'none'");
