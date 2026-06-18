import dynamic from "next/dynamic";

import { Navbar } from "~/components/landing/navbar";
import { HeroScroll } from "~/components/landing/hero-scroll";
import { RibbonBand } from "~/components/landing/ribbon-band";
import { IntegrationsStrip } from "~/components/landing/integrations-strip";
import { SecuritySection } from "~/components/landing/security-section";
import { FeatureSection } from "~/components/landing/feature-section";
import { FaqSection } from "~/components/landing/faq-section";
import { FooterTaped } from "~/components/landing/footer-taped";

const Testimonials = dynamic(
  () =>
    import("~/components/landing/testimonials").then(
      (module) => module.Testimonials,
    ),
  {
    loading: () => (
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="bg-muted h-40 animate-pulse rounded-2xl" />
        </div>
      </section>
    ),
  },
);

const Pricing = dynamic(
  () => import("~/components/landing/pricing").then((module) => module.Pricing),
  {
    loading: () => (
      <section className="bg-muted/30 py-24">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="bg-background h-80 animate-pulse rounded-2xl border"
            />
          ))}
        </div>
      </section>
    ),
  },
);

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
