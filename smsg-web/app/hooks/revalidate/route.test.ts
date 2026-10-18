import { revalidateTag } from "next/cache";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const call = (secret: string | null, body: unknown) =>
  POST(
    new Request("http://x/hooks/revalidate", {
      method: "POST",
      headers: secret ? { "x-revalidate-secret": secret } : {},
      body: JSON.stringify(body),
    }),
  );

describe("revalidate hook", () => {
  it("rejects a wrong or missing secret", async () => {
    expect((await call("nope", { tags: ["services"] })).status).toBe(401);
    expect((await call(null, { tags: ["services"] })).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
  it("rejects a bad body", async () => {
    expect((await call("dev-revalidate-secret", { tags: [] })).status).toBe(
      400,
    );
  });
  it("revalidates each tag with immediate expiry", async () => {
    const r = await call("dev-revalidate-secret", {
      tags: ["services", "post:ciao"],
    });
    expect(r.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("post:ciao", { expire: 0 });
  });
});
