import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "../styles/tokens.css";
import "./globals.css";
import { APP_NAME } from "@/lib/app";

// next/font downloads Inter at build time and serves it from this site.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Garmin activities next to body notes.",
};

export const viewport: Viewport = {
  themeColor: "#052B42",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
