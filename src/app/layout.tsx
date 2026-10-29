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
      <head>
        {/* the first picture: start fetching it before any script runs */}
        {/* (portrait screens get the portrait crop; the same split as heroVariant() in lib/seqs.ts) */}
        <link rel="preload" as="image" href={`${basePath}/img/hero-poster.webp`} media="(min-aspect-ratio: 20/21)" type="image/webp" fetchPriority="low" />
        <link rel="preload" as="image" href={`${basePath}/img/hero-poster-p.webp`} media="(max-aspect-ratio: 20/21)" type="image/webp" fetchPriority="low" />
      </head>
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
