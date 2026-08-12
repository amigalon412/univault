import type { Metadata } from "next";
import { AnimationGovernor } from "@/components/AnimationGovernor";
import { PageFooter } from "@/components/landing/PageFooter";
import { SiteNav } from "@/components/landing/SiteNav";
import { VaultApp } from "@/components/app/VaultApp";

export const metadata: Metadata = {
  title: "SAFEX — Vault app",
  description:
    "Pick a strategy, deposit USDG and let the vault do the rest. Non-custodial, on BNB Chain.",
};

export default function AppPage() {
  return (
    <main className="page-enter">
      <AnimationGovernor />
      <SiteNav />
      <VaultApp />
      <PageFooter />
    </main>
  );
}
