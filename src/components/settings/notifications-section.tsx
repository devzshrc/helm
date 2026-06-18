"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldTitle,
} from "~/components/ui/field";
import { Switch } from "~/components/ui/switch";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification03Icon } from "@hugeicons/core-free-icons";

export function NotificationsSection() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Notification03Icon}
              strokeWidth={2}
              className="text-muted-foreground size-5"
            />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Control how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Email notifications</FieldTitle>
              <FieldDescription>
                Receive daily digest of important emails
              </FieldDescription>
            </FieldContent>
            <Switch defaultChecked />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Scheduling alerts</FieldTitle>
              <FieldDescription>
                Get notified when a meeting is proposed or confirmed
              </FieldDescription>
            </FieldContent>
            <Switch defaultChecked />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Workflow failures</FieldTitle>
              <FieldDescription>
                Alert when an automated workflow fails
              </FieldDescription>
            </FieldContent>
            <Switch defaultChecked />
          </Field>
        </CardContent>
      </Card>
    </div>
  );
}
