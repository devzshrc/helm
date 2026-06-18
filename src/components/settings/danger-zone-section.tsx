"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "~/server/better-auth/client";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon, DangerIcon } from "@hugeicons/core-free-icons";

export function DangerZoneSection() {
  const router = useRouter();
  const signingOut = useRef(false);

  async function handleSignOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await authClient.signOut();
    } catch (e) {
      console.error("Sign out failed:", e);
      toast.error("Sign out had a hiccup — taking you to login.");
    } finally {
      router.push("/login");
      router.refresh();
      signingOut.current = false;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-destructive/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={DangerIcon}
              strokeWidth={2}
              className="text-destructive size-5"
            />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible actions. Please be careful.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between rounded-xl border p-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Sign out</span>
              <span className="text-muted-foreground text-xs">
                You will be redirected to the login page
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" size="sm" />}
              >
                <HugeiconsIcon
                  icon={Logout01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                Sign out
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Are you sure you want to sign out?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to sign in again to access your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSignOut}
                    variant="destructive"
                  >
                    Sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="border-border flex items-center justify-between rounded-xl border p-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Delete account</span>
              <span className="text-muted-foreground text-xs">
                Permanently delete your account and all associated data
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" size="sm" />}
              >
                Delete account
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    This action cannot be undone
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account, all your data,
                    connections, and preferences. This action is irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      toast.error("Account deletion is not yet supported.")
                    }
                  >
                    Delete account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
