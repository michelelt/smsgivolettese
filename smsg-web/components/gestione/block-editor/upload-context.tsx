"use client";

import { createContext, useContext } from "react";

/** Resolves to the MediaPath of the uploaded file. Provided by the page (stage 2: resize → upload-url → uploadToSignedUrl → complete). */
export type UploadFn = (
  file: File,
  kind: "image" | "video",
  alt?: string,
) => Promise<string>;

export const UploadContext = createContext<UploadFn | null>(null);
export const useUpload = () => {
  const u = useContext(UploadContext);
  if (!u) throw new Error("UploadContext missing");
  return u;
};
