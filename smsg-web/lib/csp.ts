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
    `media-src 'self'${supabase ? ` ${supabase}` : ""}`,
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

// ADR-062: privacy-enhanced YouTube and Vimeo (dnt) players only.
const EMBEDS = "https://www.youtube-nocookie.com https://player.vimeo.com";

// ADR-036: no hash or nonce here, it would disable 'unsafe-inline' and break Next's inline scripts.
export const publicCsp = () => {
  const cf = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? " https://challenges.cloudflare.com"
    : "";
  return build(`'self' 'unsafe-inline'${cf}`, `${cf.trim()} ${EMBEDS}`.trim());
};

export const privateCsp = (nonce: string) =>
  build(`'self' 'nonce-${nonce}' ${textSizeHash}`, EMBEDS);
