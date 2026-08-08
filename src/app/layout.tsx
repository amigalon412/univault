import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import { cookieToInitialState } from "wagmi";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { wagmiConfig } from "@/lib/wagmi";
import "./globals.css";

/* Three faces, each with one job — the split FrogPools uses.
   Space Grotesk: every heading and every figure.
   Space Mono:    eyebrows, labels, buttons, tickers. Anything in caps.
   Inter:         body copy, and nothing else. */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#edece8",
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
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${inter.variable}`}
    >
      <body>
        <Web3Provider initialState={initialState}>{children}</Web3Provider>
      </body>
    </html>
  );
}
