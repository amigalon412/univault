import { NavBar } from "@/components/NavBar";
import { HeroSection } from "@/components/HeroSection";
import { TickerMarquee } from "@/components/TickerMarquee";
import { AboutSection } from "@/components/AboutSection";
import { CommandsSection } from "@/components/CommandsSection";
import { GuideSection } from "@/components/GuideSection";
import { SecuritySection } from "@/components/SecuritySection";
import { TokenSection } from "@/components/TokenSection";
import { LiveFeed } from "@/components/LiveFeed";
import { Footer } from "@/components/Footer";
import { MatrixScroll } from "@/components/MatrixScroll";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-wire-cyan overflow-x-hidden page-enter">
      <MatrixScroll />
      <NavBar />
      <HeroSection />
      <TickerMarquee />
      <AboutSection />
      <CommandsSection />
      <GuideSection />
      <SecuritySection />
      <TokenSection />
      <LiveFeed />
      <Footer />
    </main>
  );
}
