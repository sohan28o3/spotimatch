import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Spotimatch — Your music, your people",
  description: "Build a profile from your favorite music, Last.fm listening, and Spotify history.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon.svg", apple: "/app-icon.svg" },
  appleWebApp: { capable: true, title: "SpotiMatch", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#121212", viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
