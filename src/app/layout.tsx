import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Pleco Web — Chinese Dictionary",
    template: "%s · Pleco Web",
  },
  description:
    "A desktop-class Chinese dictionary and study workspace: CC-CEDICT search in Chinese, pinyin and English, HanziJS character decomposition, phonetic analysis and animated stroke order.",
  applicationName: "Pleco Web",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c1e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen overflow-hidden">
        <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
