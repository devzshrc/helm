import { Navbar } from "~/components/landing/navbar";
import { HeroScroll } from "~/components/landing/hero-scroll";
import { RibbonBand } from "~/components/landing/ribbon-band";
import { IntegrationsStrip } from "~/components/landing/integrations-strip";
import { SecuritySection } from "~/components/landing/security-section";
import { FeatureSection } from "~/components/landing/feature-section";
import { Testimonials } from "~/components/landing/testimonials";
import { Pricing } from "~/components/landing/pricing";
import { FaqSection } from "~/components/landing/faq-section";
import { FooterTaped } from "~/components/landing/footer-taped";

export default async function Home() {
  return (
    <>
      <Navbar isAuthenticated={false} />
      <main>
        <HeroScroll isAuthenticated={false} />
        <RibbonBand />
        <IntegrationsStrip />
        <SecuritySection />
        <section id="features">
          <FeatureSection />
        </section>
        <Testimonials />
        <Pricing />
        <FaqSection />
      </main>
      <FooterTaped />
    </>
  );
}
