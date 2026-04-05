import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FaciliAid: Planning Poker",
  description: "Planning poker starter for Supabase + Vercel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
