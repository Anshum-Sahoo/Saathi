import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAATHI — Care, together",
  description: "The care circle that never lets an elder go unnoticed.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="page-main">{children}</main>
        <footer className="page-footer">A little care goes a long way. SAATHI coordinates check-ins; it does not give medical advice or verify that medicine was taken.</footer>
      </body>
    </html>
  );
}
