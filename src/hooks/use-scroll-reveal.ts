import { useEffect, useRef } from "react";
import { useInView, useAnimation } from "framer-motion";

type Controls = ReturnType<typeof useAnimation>;

export function useScrollReveal(): [React.RefObject<HTMLDivElement>, Controls] {
  const ref = useRef<HTMLDivElement>(null!);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const controls = useAnimation();

  useEffect(() => {
    if (inView) void controls.start("visible");
  }, [inView, controls]);

  return [ref, controls];
}
