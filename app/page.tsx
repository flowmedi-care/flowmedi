import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { InteractiveHeroShowcase } from "@/components/landing/interactive-hero-showcase";
import { TrustStatsBar } from "@/components/landing/trust-stats-bar";
import { FeatureExplorer } from "@/components/landing/feature-explorer";
import { ModuleSpotlights } from "@/components/landing/module-spotlight";
import { PersonasSection } from "@/components/landing/personas-section";
import { TestimonialsCarousel } from "@/components/landing/testimonials-carousel";
import { SecurityTrustSection } from "@/components/landing/security-trust-section";
import { IntegrationsStrip } from "@/components/landing/integrations-strip";
import { CtaBand } from "@/components/landing/cta-band";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        <InteractiveHeroShowcase />
        <TrustStatsBar />
        <FeatureExplorer />
        <ModuleSpotlights />
        <PersonasSection />
        <TestimonialsCarousel />
        <SecurityTrustSection />
        <IntegrationsStrip />
        <CtaBand />
      </main>

      <PublicFooter />
    </div>
  );
}
