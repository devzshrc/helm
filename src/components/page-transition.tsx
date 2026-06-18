"use client";

import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "framer-motion";

import { pageTransition } from "~/lib/motion";

/**
 * Subtle fade-up on route change. Keyed on pathname and mounts the new page
 * immediately (no AnimatePresence exit wait) so navigation stays snappy.
 * Preserves the full-height flex layout the app surfaces depend on.
 * `MotionConfig reducedMotion="user"` disables motion for users who ask.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={pathname}
        variants={pageTransition}
        initial="hidden"
        animate="visible"
        className="flex h-full min-h-0 flex-1 flex-col"
        style={{ willChange: "transform, opacity" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
