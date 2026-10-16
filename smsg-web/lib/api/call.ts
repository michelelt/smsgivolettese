import { api } from "./client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Unwraps an openapi-fetch result: data or a thrown ApiError carrying the API message. */
export async function call<T>(p: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await p;
  // 204 (e.g. respond, delete) has no body: data stays undefined and that is a success.
  if (!response.ok || (data === undefined && response.status !== 204)) {
    const e = (
      error as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | undefined
    )?.error;
    throw new ApiError(
      e?.message ?? "Operazione non riuscita. Riprova.",
      response.status,
      e?.code,
      e?.details,
    );
  }
  return data as T;
}

/** Saves a blob result (PDF/CSV) through an object URL: a plain link cannot carry the bearer. */
export async function saveBlob(
  p: Promise<Result<unknown>>,
  fallbackName: string,
) {
  const { data, error, response } = await p;
  if (!response.ok || !(data instanceof Blob)) {
    // parseAs blob makes errors blobs too: nothing useful to read, keep a generic message.
    void error;
    throw new ApiError("Download non riuscito. Riprova.", response.status);
  }
  const name =
    /filename="?([^";]+)"?/.exec(
      response.headers.get("Content-Disposition") ?? "",
    )?.[1] ?? fallbackName;
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export { api };
