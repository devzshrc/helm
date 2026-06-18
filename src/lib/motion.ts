import type { Transition, Variants } from "framer-motion";

/**
 * Shared motion tokens so every surface animates with the same physics — a
 * consistent, butter-smooth feel. Animate only `transform`/`opacity` (GPU,
 * no layout cost). Respect reduced-motion via `<MotionConfig reducedMotion="user">`
 * mounted high in the tree (see dashboard layout / agent chat).
 */

/** Quick, decisive — buttons, taps, small UI. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.6,
};

/** Gentle, settled — panels, cards, page-level motion. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
};

/** Fade up — generic entrance for a single element. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16 } },
};

/** Parent of a staggered list. Use with `listItem` children. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

/** Row/card inside a `staggerContainer`. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
};

/** Route/page transition — keyed on pathname under `AnimatePresence`. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.22, 0.61, 0.36, 1] },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
};

/** Standard hover/press feedback for interactive surfaces. */
export const tapScale = { scale: 0.97 } as const;
export const hoverLift = { y: -1 } as const;
