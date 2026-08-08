import { CommunitySection } from "@/components/landing/CommunitySection";
import { EcosystemSection } from "@/components/landing/EcosystemSection";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ScrollEffects } from "@/components/landing/ScrollEffects";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteNav } from "@/components/landing/SiteNav";
import { VaultShowcase } from "@/components/landing/VaultShowcase";
import { VaultsSection } from "@/components/landing/VaultsSection";
import { WhySection } from "@/components/landing/WhySection";

/**
 * The layer stack matters more than the section order:
 *
 *   .scrollprog  fixed,    z-60
 *   #page        relative, z-1, opaque   ← everything that scrolls
 *   .bigfoot     fixed,    z-0           ← revealed by scrolling past #page
 *
 * The footer sits OUTSIDE #page for that reason. Put it inside and it scrolls
 * with the rest and the reveal does not happen.
 */
export default function Home() {
  return (
    <>
      <ScrollEffects />

      <div id="page">
        <SiteNav />
        <Hero />
        <VaultShowcase />
        <HowItWorks />
        <EcosystemSection />
        <VaultsSection />
        <WhySection />
        <CommunitySection />
      </div>

      <SiteFooter />
    </>
  );
}
