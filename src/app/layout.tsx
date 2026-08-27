import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Archivo is a true variable font on Google Fonts (weight 100-900, width
// 62-125%), so one file gives us both the expanded Display voice and the
// condensed Data voice. next/font self-hosts it at build time, so there is no
// runtime request to Google.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

// Archivo has no Devanagari coverage; Hindi copy falls through to this.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-devanagari",
});

export const metadata: Metadata = {
  title: "BharaTransit — Delhi pilot",
  description:
    "A trustworthy navigation layer for Indian public transport. Plan a door-to-door bus and metro journey, see where your bus is, know how fresh the information is.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${devanagari.variable}`}>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased flex flex-col min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-blue-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                TB
              </span>
              <span className="text-lg font-semibold tracking-tight">
                BharaTransit
              </span>
            </Link>
            <p className="hidden text-xs text-slate-500 sm:block">
              Delhi pilot ·{" "}
              <Link
                href="/about"
                className="underline hover:text-slate-700"
              >
                How it&apos;s built
              </Link>
            </p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-4 text-xs text-slate-500">
            <p>
              Independent hackathon prototype. Not affiliated with any
              government body. No official endorsement implied.
            </p>
            <p>
              Network geometry ©{" "}
              <a
                className="underline hover:text-slate-700"
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors
              </a>{" "}
              · Tiles by OpenFreeMap · Curated prototype network inspired by
              Delhi corridors.
            </p>
            <p>
              Vehicle positions shown as{" "}
              <span className="font-semibold text-violet-700">DEMO</span> are
              synthetic realtime data generated for this prototype only.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
