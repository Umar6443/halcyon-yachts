import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({ variable: "--font-serif-src", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
const sans = Manrope({ variable: "--font-sans-src", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-src", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Halcyon Yacht Charters — Choose your yacht",
  description: "A private fleet in the Adriatic. Scroll through the fleet and step aboard.",
};
export const viewport: Viewport = { themeColor: "#06182a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
