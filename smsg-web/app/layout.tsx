import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMS Givolettese",
  description: "Società di Mutuo Soccorso Givolettese",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
