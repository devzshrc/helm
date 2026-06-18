import { type Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "~/components/login-form";
import { HelmMark } from "~/components/helm-mark";
import { BRAND } from "~/lib/brand";

export const metadata: Metadata = {
  title: `Sign in — ${BRAND}`,
  description:
    "Sign in to Helm — your Gmail and Calendar workspace with an AI agent.",
};

export default async function LoginPage() {
  return (
    <div className="bg-background relative flex min-h-svh flex-col items-center justify-center px-4">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
      {/* Radial fade over grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,transparent_40%,hsl(var(--background))_100%)]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex flex-col items-center gap-2">
          <HelmMark className="size-12" />
          <span className="text-foreground font-serif text-3xl tracking-tight">
            {BRAND}
          </span>
          <span className="text-muted-foreground text-xs">
            AI agent for Gmail &amp; Calendar
          </span>
        </Link>

        <LoginForm />
      </div>
    </div>
  );
}
