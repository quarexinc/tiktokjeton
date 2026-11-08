import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiktok Jetonlu Yayın Bulma",
  description: "Jeton dağıtılan TikTok canlı yayınlarını tek yerde bul, tek dokunuşla yayına geç.",
};

export const viewport: Viewport = {
  themeColor: "#170c24",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
