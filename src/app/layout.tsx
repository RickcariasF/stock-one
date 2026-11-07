import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "@/styles/globals.css";
import { site } from "@/lib/catalog";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.tagline,
  openGraph: { siteName: site.name, type: "website", locale: site.locale.replace("-", "_") },
};

// Debe coincidir con --stock-one-paper.
export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={site.locale.split("-")[0]}>
      <body>{children}</body>
    </html>
  );
}
