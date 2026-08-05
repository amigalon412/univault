import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { cookieToInitialState } from "wagmi";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { LogoFall } from "@/components/LogoFall";
import { wagmiConfig } from "@/lib/wagmi";
import "./globals.css";

/**
 * One family for the whole site.
 *
 * Uniswap sets its interface in "Basel", which is not distributable; Inter is
 * what it used before that and what every clone of it uses now. Both --font-sans
 * and --font-mono in globals.css point here, so the ~200 `font-mono` classes
 * this codebase inherited from its terminal era render as UI text without any
 * of them being touched.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
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
  title: "UNIVAULT — Grow your bag, automatically",
  description:
    "A non-custodial auto-yield vault on Robinhood Chain. Deposit stablecoin, earn real yield, grow into tokenized stocks — auto-rebalanced.",
  openGraph: {
    title: "UNIVAULT",
    description:
      "Deposit stablecoin. Earn real yield. Grow into tokenized stocks, auto-rebalanced. Non-custodial.",
    images: ["/seo/banner.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "UNIVAULT",
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
    <html lang="en" className={`${inter.variable} dark`}>
      <body>
        {/* Sits behind every route rather than on the homepage alone. The page
            backgrounds are transparent so it shows through; each <main> carries
            `relative z-10` to stay above this canvas, which is positioned and
            would otherwise paint over static content. */}
        <LogoFall />
        <Web3Provider initialState={initialState}>{children}</Web3Provider>
      </body>
    </html>
  );
}
