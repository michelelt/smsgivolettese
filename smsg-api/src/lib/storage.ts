import { supabaseAdmin } from './supabase-admin.js';

export type UploadTarget = { bucket: string; path: string; token: string; signedUrl: string };

export async function signedUpload(bucket: string, path: string): Promise<UploadTarget> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error('storage: signed upload url failed');
  return { bucket, path, token: data.token, signedUrl: data.signedUrl };
}

/** Real size and mime of an uploaded object; null when missing (or unreadable: callers treat both as "not uploaded"). */
export async function objectInfo(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin().storage.from(bucket).info(path);
  if (error || !data) return null;
  return { size: data.size ?? 0, mime: (data.contentType ?? '').split(';')[0]!.trim() };
}

export async function copyObject(from: string, to: string, fromBucket: string, toBucket: string) {
  const { error } = await supabaseAdmin()
    .storage.from(fromBucket)
    .copy(from, to, { destinationBucket: toBucket });
  if (error) throw new Error('storage: copy failed');
}

/** Best effort in batches of 100 (Storage forbids SQL deletes); returns how many were removed. */
export async function removeObjects(bucket: string, paths: string[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error } = await supabaseAdmin()
      .storage.from(bucket)
      .remove(paths.slice(i, i + 100));
    if (!error) n += data?.length ?? 0;
  }
  return n;
}

export async function signedReadUrl(bucket: string, path: string, seconds: number) {
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, seconds);
  return error || !data ? null : data.signedUrl;
}
