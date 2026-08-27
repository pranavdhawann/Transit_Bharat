import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Archivo, Noto_Sans_Devanagari } from "next/font/google";
import Wordmark from "@/components/Wordmark";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EF" },
    { media: "(prefers-color-scheme: dark)", color: "#10151A" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${devanagari.variable}`}>
      <body className="bg-paper type-body text-ink antialiased flex min-h-screen flex-col">
        <div aria-hidden className="h-[3px] bg-saffron" />
        <header className="border-b border-rule bg-surface">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-4">
            <Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron">
              <Wordmark />
            </Link>
            <p className="type-micro text-ink-3">
              Delhi pilot ·{" "}
              <Link href="/about" className="underline hover:text-ink">
                How it&apos;s built
              </Link>
            </p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-rule bg-surface">
          <details className="mx-auto max-w-6xl px-4 py-3" open>
            <summary className="type-micro cursor-pointer text-ink-3">
              Disclaimers and data sources
            </summary>
            <div className="space-y-1 py-2 text-xs text-ink-3">
              <p>
                Independent hackathon prototype. Not affiliated with any
                government body. No official endorsement implied.
              </p>
              <p>
                Network geometry ©{" "}
                <a
                  className="underline hover:text-ink"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap contributors
                </a>{" "}
                · Tiles by OpenFreeMap · Address search by Photon · Street
                shapes by FOSSGIS routing services · Curated prototype network
                inspired by Delhi corridors.
              </p>
              <p>
                Vehicle positions shown as{" "}
                <span className="font-semibold text-ink-2">DEMO</span> are
                synthetic realtime data generated for this prototype only.
              </p>
            </div>
          </details>
        </footer>
      </body>
    </html>
  );
}
