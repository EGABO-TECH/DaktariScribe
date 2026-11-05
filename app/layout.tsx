import type { Metadata, Viewport } from "next";
import { Inter, Hanken_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0d2240",
};

export const metadata: Metadata = {
  title: "DaktariScribe — Field notes to finished reports",
  description:
    "Clinical documentation for frontline health teams. Capture encounters by typing, voice or upload, review and sign off, then export clear field reports and health records.",
  keywords: [
    "clinical documentation",
    "field reports",
    "health records",
    "clinical notes",
    "frontline health",
  ],
  openGraph: {
    title: "DaktariScribe",
    description:
      "Clinical documentation and field reports for frontline health teams.",
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
      <html lang="en" className={`${inter.variable} ${hanken.variable} h-full antialiased`} suppressHydrationWarning>
        <head>
          {/* Apply the saved theme before paint to avoid a flash. */}
          <script
            dangerouslySetInnerHTML={{
              __html:
                "try{var t=localStorage.getItem('ds-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}",
            }}
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          />
        </head>
        <body className="h-full bg-[#f0f7f6] text-[#0d2240] overflow-x-hidden">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
