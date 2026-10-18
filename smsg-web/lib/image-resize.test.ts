import { afterEach, describe, expect, it, vi } from "vitest";
import { fitSize, resizeImage } from "./image-resize";

describe("fitSize", () => {
  it("caps the long side at 2000", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitSize(3000, 6000)).toEqual({ width: 1000, height: 2000 });
  });
  it("never upscales", () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("resizeImage", () => {
  afterEach(() => vi.unstubAllGlobals());
  const setup = (encodes: string[]) => {
    const drawImage = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 4000, height: 2000, close() {} })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (cb, type) =>
        cb(
          new Blob(["x"], {
            type: encodes.includes(type!) ? type : "image/png",
          }),
        ),
    );
    return drawImage;
  };
  const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

  it("outputs WebP with the long side ≤ 2000", async () => {
    const draw = setup(["image/webp", "image/jpeg"]);
    const r = await resizeImage(file);
    expect(r).toMatchObject({ mime: "image/webp", width: 2000, height: 1000 });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1000);
  });
  it("falls back to JPEG when WebP is not encodable", async () => {
    setup(["image/jpeg"]);
    expect((await resizeImage(file)).mime).toBe("image/jpeg");
  });
});
