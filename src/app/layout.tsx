import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif-src", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap" });
const sans = Manrope({ variable: "--font-sans-src", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-mono-src", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const site = process.env.NEXT_PUBLIC_SITE_URL || "https://umar6443.github.io";
const description = "Exclusive Web3, crypto and NFT events on luxury yachts. Explore four themed yachts in 360°, step inside and book.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "BLOCKTIDE — Web3 Yacht Events",
  description,
  openGraph: { title: "BLOCKTIDE — Web3 Yacht Events", description, images: [`${basePath}/img/og.jpg`], type: "website" },
  twitter: { card: "summary_large_image", title: "BLOCKTIDE — Web3 Yacht Events", description, images: [`${basePath}/img/og.jpg`] },
};
export const viewport: Viewport = { themeColor: "#050b16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
