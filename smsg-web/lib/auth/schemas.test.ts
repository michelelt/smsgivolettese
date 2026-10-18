import { loginSchema, setPasswordSchema } from "./schemas";

it("validates login and password setting", () => {
  expect(loginSchema.safeParse({ email: "x", password: "a" }).success).toBe(
    false,
  );
  expect(
    loginSchema.safeParse({ email: "a@b.it", password: "a" }).success,
  ).toBe(true);
  expect(
    setPasswordSchema.safeParse({ password: "short", confirm: "short" })
      .success,
  ).toBe(false);
  expect(
    setPasswordSchema.safeParse({
      password: "undici11111",
      confirm: "undici11111",
    }).success,
  ).toBe(false);
  expect(
    setPasswordSchema.safeParse({
      password: "lunghissima12",
      confirm: "diversa12345",
    }).success,
  ).toBe(false);
  expect(
    setPasswordSchema.safeParse({
      password: "lunghissima12",
      confirm: "lunghissima12",
    }).success,
  ).toBe(true);
});
