import type { Metadata } from "next";
import { headers } from "next/headers";
import { VT323, Share_Tech_Mono, Chakra_Petch } from "next/font/google";
import { cookieToInitialState } from "wagmi";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { Starfall } from "@/components/Starfall";
import { wagmiConfig } from "@/lib/wagmi";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
  fallback: ["monospace"],
  adjustFontFallback: false,
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-share-tech-mono",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});

// Squared, technological face used only for the money read-outs and split
// numbers — cut-corner geometry that fits the terminal/matrix look while
// staying legible, with tabular figures so digits never jitter.
const chakraPetch = Chakra_Petch({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-digits",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: false,
});

// Vercel injects the production domain, so social images resolve correctly
// without hardcoding it. Override with NEXT_PUBLIC_SITE_URL on a custom domain.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "BLUR — Grow your bag, automatically",
  description:
    "A non-custodial auto-yield vault on Robinhood Chain. Deposit stablecoin, earn real yield, grow into tokenized stocks — auto-rebalanced.",
  openGraph: {
    title: "BLUR",
    description:
      "Deposit stablecoin. Earn real yield. Grow into tokenized stocks, auto-rebalanced. Non-custodial.",
    images: ["/seo/banner.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "BLUR",
    description:
      "Deposit stablecoin. Earn real yield. Grow into tokenized stocks, auto-rebalanced. Non-custodial.",
    images: ["/seo/banner.png"],
  },
  icons: {
    shortcut: "/seo/favicon-32.png",
    icon: [
      { url: "/seo/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/seo/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/seo/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Rehydrate the wallet connection from the cookie wagmi wrote, so a refresh
  // keeps the wallet connected instead of dropping it.
  const initialState = cookieToInitialState(
    wagmiConfig,
    (await headers()).get("cookie"),
  );

  return (
    <html
      lang="en"
      className={`${vt323.variable} ${shareTechMono.variable} ${chakraPetch.variable} dark`}
    >
      <body>
        {/* Sits behind every route rather than on the homepage alone. The page
            backgrounds are transparent so it shows through; each <main> carries
            `relative z-10` to stay above this canvas, which is positioned and
            would otherwise paint over static content. */}
        <Starfall />
        <Web3Provider initialState={initialState}>{children}</Web3Provider>
      </body>
    </html>
  );
}
