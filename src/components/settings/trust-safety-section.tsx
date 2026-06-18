"use client";

import {
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const GUARDED_ACTIONS = [
  "Send or reply to email",
  "Create, update, or delete calendar events",
  "Enable workflows",
  "Apply bulk cleanup actions",
];

export function TrustSafetySection() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground h-5 w-5" />
            <CardTitle>Trust & Safety</CardTitle>
          </div>
          <CardDescription>
            Helm is designed to prepare actions first and execute writes only
            after explicit review.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <Mail className="text-muted-foreground h-4 w-4" />
              <p className="mt-2 text-sm font-medium">Gmail scoped</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Reads and actions use your authenticated tenant only.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <Workflow className="text-muted-foreground h-4 w-4" />
              <p className="mt-2 text-sm font-medium">Draft-first workflows</p>
              <p className="text-muted-foreground mt-1 text-xs">
                AI-created automations save disabled until reviewed.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <LockKeyhole className="text-muted-foreground h-4 w-4" />
              <p className="mt-2 text-sm font-medium">Limited integrations</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Helm only uses the connected Gmail and Calendar scopes shown in
                integrations.
              </p>
            </div>
          </div>
          <div className="bg-muted/20 rounded-lg border p-3">
            <p className="text-sm font-semibold">Actions requiring review</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GUARDED_ACTIONS.map((action) => (
                <div key={action} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {action}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
