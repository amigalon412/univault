import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { AnimationGovernor } from "@/components/AnimationGovernor";
import { BackgroundGrid } from "@/components/app/BackgroundGrid";
import { VaultApp } from "@/components/app/VaultApp";

export const metadata: Metadata = {
  title: "BLUR — Vault terminal",
  description:
    "Pick a strategy, deposit USDG and let the vault do the rest. Non-custodial, on Robinhood Chain.",
};

export default function AppPage() {
  return (
    <main className="relative z-10 min-h-screen text-wire-cyan overflow-x-hidden page-enter">
      <BackgroundGrid />
      <AnimationGovernor />
      <NavBar />
      <div className="relative z-10">
        <VaultApp />
        <Footer />
      </div>
    </main>
  );
}
