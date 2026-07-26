import { NavBar } from "@/components/NavBar";
import { HeroSection } from "@/components/HeroSection";
import { TickerMarquee } from "@/components/TickerMarquee";
import { VaultPreview } from "@/components/VaultPreview";
import { AboutSection } from "@/components/AboutSection";
import { MechanicsSection } from "@/components/MechanicsSection";
import { TrustSection } from "@/components/TrustSection";
import { TokenSection } from "@/components/TokenSection";
import { LiveFeed } from "@/components/LiveFeed";
import { Footer } from "@/components/Footer";
import { MatrixScroll } from "@/components/MatrixScroll";
import { AnimationGovernor } from "@/components/AnimationGovernor";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-wire-cyan overflow-x-hidden page-enter">
      <MatrixScroll />
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
      <TokenSection />
      <LiveFeed />
      <Footer />
    </main>
  );
}
