import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Spotimatch — Your music, your people", description: "Build a profile from your favorite music, Last.fm listening, and Spotify history." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
