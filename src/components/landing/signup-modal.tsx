"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { TocDialog } from "~/components/ui/terms-conditions";
import { authClient } from "~/server/better-auth/client";

export function SignupModal({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard/agent",
    });
    setLoading(false);
  }

  return (
    <Dialog>
      <DialogTrigger render={<span />}>{children}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full border"
            aria-hidden="true"
          >
            <Image
              src="/corsair-logo.webp"
              alt="logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-full"
            />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">
              Get started with Helm
            </DialogTitle>
            <DialogDescription className="text-center">
              Connect your Google account to start using your AI agent.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={signInWithGoogle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              fill="currentColor"
            />
          </svg>
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          By signing up you agree to our{" "}
          <TocDialog>
            <span className="underline hover:no-underline">Terms</span>
          </TocDialog>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
