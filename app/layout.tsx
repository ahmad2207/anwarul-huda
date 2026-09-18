import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// DESIGN.md section 3: Plus Jakarta Sans carries the interface, Fraunces
// carries anything that announces itself (page titles, card titles, the
// wordmark), IBM Plex Mono is for figures only (amounts, member numbers,
// receipt numbers), IBM Plex Sans Arabic is for the four places Arabic
// appears (the login lockup and three printed artefacts). All four self
// hosted via next/font.
//
// Plus Jakarta Sans and IBM Plex Mono both carry formatNaira's output
// (the mono face for every <Money> figure, the sans face for the plain
// text totals that appear outside a table cell), and both need
// latin-ext as well as latin: the Naira sign, U+20A6, sits in Google's
// latin-ext glyph range for these two families, not latin, confirmed
// against the subsetted @font-face rules Google Fonts itself serves.
// Requesting latin alone would leave every ₦ in the interface, and on
// paper the office hands to a member, falling back to whatever font the
// browser substitutes for the one missing glyph.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Anwaru-l-Huda League",
  description: "Membership and administration system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${fraunces.variable} ${ibmPlexSansArabic.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
