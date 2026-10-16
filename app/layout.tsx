import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { EB_Garamond, Gentium_Plus, Inter, Noto_Serif_Hebrew } from "next/font/google";
import "./globals.css";

const scripture = EB_Garamond({
  variable: "--font-scripture",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const ui = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
});

// Original-language faces are used from Phase 4 on; not preloaded until then.
const hebrew = Noto_Serif_Hebrew({
  variable: "--font-hebrew-face",
  subsets: ["hebrew"],
  preload: false,
});

const greek = Gentium_Plus({
  variable: "--font-greek-face",
  weight: ["400", "700"],
  subsets: ["greek", "greek-ext"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Bible Study",
  description: "Parallel reading, cross-reference iconograph, and original-language concordance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${scripture.variable} ${ui.variable} ${hebrew.variable} ${greek.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        {/* Cookieless page-view analytics; no study content involved. Inactive in development. */}
        <Analytics />
      </body>
    </html>
  );
}
