"use client";

import { useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { ContainerScroll } from "~/components/ui/container-scroll-animation";
import { AuroraBackground } from "~/components/ui/aurora-background";
import { Button } from "~/components/ui/button";
import TextCursorProximity from "~/components/ui/text-cursor-proximity";
import { DashboardPreview } from "~/components/landing/dashboard-preview";

export function HeroScroll({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);

  // Cursor glow
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const glowX = useSpring(rawX, { stiffness: 120, damping: 24, mass: 0.5 });
  const glowY = useSpring(rawY, { stiffness: 120, damping: 24, mass: 0.5 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set(e.clientX - rect.left);
    rawY.set(e.clientY - rect.top);
  }

  const proximity = {
    transform: { from: "scale(1)", to: "scale(1.18)" },
    fontWeight: { from: 300, to: 650 },
  } as const;

  return (
    <AuroraBackground
      ref={heroRef}
      className="overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Cursor glow — stays behind content (z-0), clipped to hero bounds */}
      <motion.div
        className="bg-primary/10 pointer-events-none absolute z-0 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]"
        style={{ left: glowX, top: glowY }}
      />

      <ContainerScroll
        titleComponent={
          <div className="flex flex-col items-center px-4 pt-16 pb-24 md:pb-32">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-4 py-1.5 backdrop-blur-sm dark:border-white/20 dark:bg-white/10">
              <span className="text-sm font-medium tracking-tight text-black/60 sm:text-base dark:text-white/80">
                Powered by
              </span>
              <Image
                alt=""
                width={20}
                height={20}
                decoding="async"
                data-nimg="1"
                className="size-5 rounded-sm"
                style={{ color: "transparent" }}
                src="/corsair-logo.webp"
              />
              <span className="text-sm font-semibold tracking-tight text-black sm:text-base dark:text-white">
                Corsair
              </span>
            </div>
            <h1 className="text-foreground flex flex-col items-center text-4xl tracking-tight sm:text-5xl md:text-7xl">
              <TextCursorProximity
                label="Your AI agent"
                containerRef={heroRef}
                radius={90}
                falloff="gaussian"
                styles={proximity}
                className="leading-none font-light will-change-transform"
              />
              <TextCursorProximity
                label="for Gmail & Calendar"
                containerRef={heroRef}
                radius={90}
                falloff="gaussian"
                styles={proximity}
                className="text-muted-foreground mt-2 leading-none font-light will-change-transform"
              />
            </h1>
            <p className="text-muted-foreground mx-auto mt-7 max-w-xl text-base md:text-lg">
              Nobody designed your inbox for you. So we did.
            </p>
            <Button
              size="lg"
              style={{ color: "#ffffff" }}
              className="shimmer-btn bg-primary shadow-primary/20 hover:bg-primary/90 mt-3 h-12 rounded-full px-8 text-base font-medium shadow-lg [&_*]:text-white"
              onClick={() =>
                router.push(isAuthenticated ? "/dashboard" : "/login")
              }
            >
              <span className="text-white">Connect Gmail &amp; Calendar</span>
            </Button>
          </div>
        }
      >
        <DashboardPreview />
      </ContainerScroll>
    </AuroraBackground>
  );
}
