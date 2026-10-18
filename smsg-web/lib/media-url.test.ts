import { expect, it, vi } from "vitest";
import { mediaUrl } from "./media-url";

it("builds the public Storage URL", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  expect(mediaUrl("2026/a.webp")).toBe(
    "http://127.0.0.1:54321/storage/v1/object/public/media/2026/a.webp",
  );
});
