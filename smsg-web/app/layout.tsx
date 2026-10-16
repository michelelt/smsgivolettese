import type { Metadata, Viewport } from "next";
import { parseEnv } from "@/lib/env";
import { TEXT_SIZE_SCRIPT } from "@/lib/text-size";
import "./globals.css";

const title = "SMS Givolettese";
const description =
  "Società di Mutuo Soccorso Givolettese: visite, prelievi, accompagnamenti e momenti insieme per i soci e le loro famiglie.";

export const metadata: Metadata = {
  metadataBase: new URL(parseEnv(process.env).SITE_URL),
  title: { default: title, template: `%s — ${title}` },
  description,
  applicationName: title,
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: title,
    title,
    description,
    images: [{ url: "/icon-512.png", width: 512, height: 512 }],
  },
};

export const viewport: Viewport = { themeColor: "#7a1e2c" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
