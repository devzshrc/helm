import Image from "next/image";

import { cn } from "~/lib/utils";

/**
 * The Helm brand/agent mark — the same helm.webp used in the landing navbar.
 * Single source of truth so Helm + the agent look identical everywhere.
 * `mix-blend` + `dark:invert` keep it legible on both light and dark surfaces.
 */
export function HelmMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src="/helm.webp"
      alt={alt}
      width={56}
      height={56}
      unoptimized
      className={cn(
        "object-contain mix-blend-multiply dark:mix-blend-screen dark:invert",
        className,
      )}
      style={{ color: "transparent" }}
    />
  );
}
