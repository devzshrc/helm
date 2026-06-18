"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "~/lib/utils";

export interface InfiniteRibbonProps {
  repeat?: number;
  /** Base loop seconds (lower = faster idle scroll). */
  duration?: number;
  reverse?: boolean;
  rotation?: number;
  /** How much page-scroll velocity speeds up the ribbon. 0 disables. */
  velocityFactor?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Marquee whose speed is scroll-relative: it idles at `duration`, then
 * accelerates with page-scroll velocity and eases back when you stop. Driven
 * by rAF transforms (not a CSS animation) because animation-duration can't be
 * retargeted mid-loop without a visible jump.
 */
export function InfiniteRibbon({
  repeat = 5,
  duration = 10,
  reverse = false,
  rotation = 0,
  velocityFactor = 0.5,
  children,
  className,
}: InfiniteRibbonProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const repeatCount = Math.max(1, Math.floor(repeat));

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const dir = reverse ? 1 : -1;
    let half = track.scrollWidth / 2; // one full copy of the content
    let offset = 0; // px travelled, wrapped into [0, half)
    let vel = 0; // smoothed page-scroll velocity (px/frame)
    let lastY = window.scrollY;
    let lastT = performance.now();
    let raf = 0;

    const onScroll = () => {
      const y = window.scrollY;
      vel = y - lastY;
      lastY = y;
    };
    const onResize = () => {
      half = track.scrollWidth / 2;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const base = half > 0 ? half / Math.max(0.1, duration) : 0; // px/s idle
      const boost = Math.abs(vel) * velocityFactor * 60; // scroll-driven px/s
      offset += (base + boost) * dt;
      if (half > 0) offset = ((offset % half) + half) % half;
      vel *= 0.9; // ease back to idle when scrolling stops
      const x = dir < 0 ? -offset : -(half - offset);
      track.style.transform = `translate3d(${x}px,0,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [duration, reverse, velocityFactor]);

  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground w-full max-w-full overflow-hidden py-2.5 text-sm font-medium tracking-tight",
        className,
      )}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
    >
      <span className="sr-only">{children}</span>
      <div
        ref={trackRef}
        aria-hidden="true"
        className="flex w-max whitespace-nowrap will-change-transform"
      >
        {Array.from({ length: repeatCount * 2 }, (_, index) => (
          <span className="mr-8 inline-block select-none" key={index}>
            {children}
          </span>
        ))}
      </div>
    </div>
  );
}
