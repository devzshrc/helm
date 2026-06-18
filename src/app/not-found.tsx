import Link from "next/link";

import { buttonVariants } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-serif text-6xl">404</p>
      <h1 className="text-lg font-medium">This page doesn’t exist</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        The page you’re looking for may have moved or never existed.
      </p>
      <Link href="/dashboard/agent" className={buttonVariants()}>
        Back to Helm
      </Link>
    </div>
  );
}
