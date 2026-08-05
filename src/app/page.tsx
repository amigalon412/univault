import { NavBar } from "@/components/NavBar";
import { HeroSection } from "@/components/HeroSection";
import { TickerMarquee } from "@/components/TickerMarquee";
import { VaultPreview } from "@/components/VaultPreview";
import { AboutSection } from "@/components/AboutSection";
import { MechanicsSection } from "@/components/MechanicsSection";
import { TrustSection } from "@/components/TrustSection";
import { LiveFeed } from "@/components/LiveFeed";
import { Footer } from "@/components/Footer";
import { AnimationGovernor } from "@/components/AnimationGovernor";

export default function Home() {
  return (
    /* No background of its own: the falling-logo canvas in the root layout sits
       behind every route, and body already paints the page grey. `relative z-10`
       keeps the content above that canvas. */
    <main className="relative z-10 min-h-screen text-white overflow-x-hidden page-enter">
      <AnimationGovernor />
      <NavBar />
      <HeroSection />
      <TickerMarquee />
      {/* Straight after the fold: the product itself, before any prose. */}
      <VaultPreview />
      <AboutSection />
      {/* The two sections that are not grids of text cards. Mechanics replaces
          a duplicate of the vault preview and absorbs the old flywheel; trust
          absorbs the old security cards. */}
      <MechanicsSection />
      <TrustSection />
      <LiveFeed />
      <Footer />
    </main>
  );
}
