import type { Metadata } from "next";
import { ChangePasswordForm } from "./form";

export const metadata: Metadata = {
  title: "Cambia password — SMS Givolettese",
};

export default function CambiaPassword() {
  return (
    <>
      <h1 className="text-4xl font-extrabold text-bordeaux">Cambia password</h1>
      <ChangePasswordForm />
    </>
  );
}
