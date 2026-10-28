import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0d2240",
};

export const metadata: Metadata = {
  title: "DaktariScribe — Voice-Powered Medical Scribe for Frontline Healthcare",
  description:
    "DaktariScribe: Voice-first & text scribe clinical intelligence for frontline health outreach. Capture encounters, synthesize findings, and generate clinician-ready PDF reports.",
  keywords: [
    "medical scribe",
    "voice dictation",
    "healthcare AI",
    "clinical notes",
    "frontline health",
  ],
  openGraph: {
    title: "DaktariScribe",
    description:
      "Voice-first & text scribe clinical intelligence for frontline health outreach.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="h-full bg-[#f0f7f6] text-[#0d2240] overflow-x-hidden">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
