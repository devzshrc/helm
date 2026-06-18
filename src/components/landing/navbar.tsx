"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useVelocity,
} from "framer-motion";

import { BRAND } from "~/lib/brand";
import { Button } from "~/components/ui/button";
import { HelmMark } from "~/components/helm-mark";
import { ThemeToggle } from "~/components/theme-toggle";

export function Navbar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Hysteresis band (enter pill past 32px, exit back below 16px) so
    // hovering near the threshold doesn't re-trigger the transition.
    const onScroll = () => {
      setScrolled((prev) => (prev ? window.scrollY > 16 : window.scrollY > 32));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Spin the helm mark in step with scrolling — only moves while the page
  // scrolls (no idle spin), direction follows scroll. Uses framer's scroll
  // tracking so it works with the custom smooth-scroll too. ~0.5° per px.
  const { scrollY } = useScroll();
  const scrollVel = useVelocity(scrollY);
  const rotate = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const px = scrollVel.get() * (delta / 1000); // pixels scrolled this frame
    rotate.set(rotate.get() + px * 0.5);
  });

  return (
    // Outer anchor — always fixed, invisible. A single motion element below
    // owns every size-affecting property (width/height/padding/radius), so
    // the spring drives one coherent transition instead of two nested
    // `layout`-tracked boxes correcting against each other (the previous
    // cause of the jittery snap).
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 340, damping: 38, mass: 1 }}
        animate={scrolled ? "pill" : "bar"}
        variants={{
          bar: {
            width: "100%",
            height: 64,
            borderRadius: 0,
            paddingLeft: 24,
            paddingRight: 24,
            marginTop: 0,
          },
          pill: {
            width: "fit-content",
            height: 44,
            borderRadius: 9999,
            paddingLeft: 20,
            paddingRight: 20,
            marginTop: 12,
          },
        }}
        className={`pointer-events-auto relative mx-auto flex max-w-6xl items-center gap-3 backdrop-blur-xl transition-colors duration-300 ${
          scrolled ? "bg-background/50" : "bg-transparent"
        }`}
      >
        {/* Logo: helm mark (spins on scroll) + wordmark */}
        <Link
          href="/"
          className="text-foreground flex shrink-0 items-center gap-1.5 font-serif text-xl tracking-tight"
        >
          <motion.div
            style={{ rotate }}
            className="size-7 shrink-0 will-change-transform"
          >
            <HelmMark className="size-full" />
          </motion.div>
          {BRAND}
        </Link>

        <div className="flex-1" />

        {/* CTA */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Theme toggle hides once the bar collapses into the pill. */}
          <AnimatePresence initial={false}>
            {!scrolled && (
              <motion.div
                key="theme-toggle"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <ThemeToggle />
              </motion.div>
            )}
          </AnimatePresence>
          <Button
            size="sm"
            render={<Link href={isAuthenticated ? "/dashboard" : "/login"} />}
          >
            {isAuthenticated ? "Launch Helm" : "Connect Account"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
