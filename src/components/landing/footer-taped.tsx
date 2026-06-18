import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Linkedin01Icon, NewTwitterIcon } from "@hugeicons/core-free-icons";

import { BRAND } from "~/lib/brand";

const tape = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="95"
    height="80"
    viewBox="0 0 95 80"
    fill="none"
  >
    <path
      d="M1 45L70.282 5L88.282 36.1769L19 76.1769L1 45Z"
      className="fill-foreground/80"
    />
  </svg>
);

const PRODUCT = [
  { label: "Inbox", href: "/login" },
  { label: "Calendar", href: "/login" },
  { label: "Workflows", href: "/login" },
  { label: "Agent", href: "/login" },
];
const RESOURCES = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Built on Corsair", href: "https://corsair.dev" },
];
const LEGAL = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "#" },
];

export function FooterTaped() {
  const year = new Date().getFullYear();

  return (
    <footer className="mx-auto my-10 max-w-5xl px-4">
      <div className="bg-card relative flex flex-col items-start justify-between gap-6 rounded-3xl border px-4 py-10 md:flex-row md:px-8">
        <div className="absolute -top-4 -left-6 hidden scale-75 md:block">
          {tape}
        </div>
        <div className="absolute -top-4 -right-6 hidden scale-75 rotate-90 md:block">
          {tape}
        </div>

        <div className="flex flex-1 flex-col items-start justify-between gap-6 md:flex-row md:gap-10 md:px-4">
          <div className="flex max-w-xs flex-col items-start gap-2">
            <span className="text-foreground font-serif text-2xl tracking-tight">
              {BRAND}
            </span>
            <p className="text-muted-foreground text-sm font-medium">
              Mail and calendar in one fast, keyboard-driven workspace — with an
              AI agent that acts for you, with your approval.
            </p>
          </div>

          <div className="flex flex-row gap-12 md:gap-20">
            <FooterCol title="Product" links={PRODUCT} />
            <FooterCol title="Resources" links={RESOURCES} />
            <FooterCol title="Legal" links={LEGAL} />
          </div>
        </div>
      </div>

      <div className="text-muted-foreground my-4 flex flex-col items-start justify-between gap-4 px-4 text-sm md:flex-row md:items-center md:px-8">
        <p className="whitespace-nowrap">
          © {year} {BRAND}. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://www.linkedin.com/in/devzshrc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn — devzshrc"
            className="hover:text-foreground transition-colors"
          >
            <HugeiconsIcon
              icon={Linkedin01Icon}
              strokeWidth={2}
              className="size-5"
            />
          </a>
          <a
            href="https://x.com/devzshrc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X — devzshrc"
            className="hover:text-foreground transition-colors"
          >
            <HugeiconsIcon
              icon={NewTwitterIcon}
              strokeWidth={2}
              className="size-5"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="text-muted-foreground hover:text-foreground text-sm font-medium whitespace-nowrap transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
