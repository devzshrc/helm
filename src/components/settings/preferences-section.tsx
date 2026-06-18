"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Label } from "~/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";

const FOCUS_LEVELS = [
  {
    value: "Urgent",
    label: "Urgent only",
    description: "Only notify for urgent emails",
  },
  {
    value: "Important",
    label: "Important",
    description: "Notify for urgent and important emails",
  },
  { value: "All", label: "All", description: "Notify for all incoming emails" },
] as const;

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

function prefText(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" ? value : fallback;
}

function prefList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join("\n");
  }
  return typeof value === "string" ? value : "";
}

export function PreferencesSection() {
  const utils = api.useUtils();
  const { data: prefs } = api.preferences.get.useQuery();
  const setTimezone = api.preferences.setTimezone.useMutation();
  const setFocusThreshold = api.preferences.setFocusThreshold.useMutation();
  const setTriagePrefs = api.preferences.setTriagePrefs.useMutation();

  const [timezone, setTimezoneLocal] = useState("UTC");
  const [focusLevel, setFocusLevel] = useState("Important");
  const [workHours, setWorkHours] = useState("09:00-17:00");
  const [writingTone, setWritingTone] = useState("Warm, concise, and direct");
  const [vipContacts, setVipContacts] = useState("");
  const [protectedSenders, setProtectedSenders] = useState("");
  const [automationComfort, setAutomationComfort] =
    useState("Review every write");

  useEffect(() => {
    if (prefs) {
      setTimezoneLocal(prefs.timezone);
      setFocusLevel(prefs.focusThreshold);
      const triage = prefs.triagePrefs;
      setWorkHours(prefText(triage.workHours, "09:00-17:00"));
      setWritingTone(prefText(triage.writingTone, "Warm, concise, and direct"));
      setVipContacts(prefList(triage.vipContacts));
      setProtectedSenders(prefList(triage.protectedSenders));
      setAutomationComfort(
        prefText(triage.automationComfort, "Review every write"),
      );
    }
  }, [prefs]);

  function handleTimezoneChange(value: string | null) {
    if (!value) return;
    setTimezoneLocal(value);
    setTimezone.mutate(
      { timezone: value },
      {
        onSuccess: () => {
          toast.success("Timezone updated");
          void utils.preferences.get.invalidate();
        },
        onError: () => toast.error("Failed to update timezone"),
      },
    );
  }

  function handleFocusChange(value: string | null) {
    if (!value) return;
    setFocusLevel(value);
    setFocusThreshold.mutate(
      { level: value },
      {
        onSuccess: () => {
          toast.success("Focus threshold updated");
          void utils.preferences.get.invalidate();
        },
        onError: () => toast.error("Failed to update focus threshold"),
      },
    );
  }

  function savePersonalization() {
    setTriagePrefs.mutate(
      {
        prefs: {
          ...(prefs?.triagePrefs ?? {}),
          workHours,
          writingTone,
          vipContacts: vipContacts
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          protectedSenders: protectedSenders
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
          automationComfort,
        },
      },
      {
        onSuccess: () => {
          toast.success("Personalization saved");
          void utils.preferences.get.invalidate();
        },
        onError: () => toast.error("Failed to save personalization"),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Settings02Icon}
              strokeWidth={2}
              className="text-muted-foreground size-5"
            />
            <CardTitle>Preferences</CardTitle>
          </div>
          <CardDescription>
            Customize how the app behaves and schedules around your time.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field
            orientation="horizontal"
            className="flex-col gap-2 sm:flex-row sm:items-start"
          >
            <FieldContent>
              <FieldTitle>Timezone</FieldTitle>
              <FieldDescription>
                Used by the scheduling concierge to find meeting times in your
                local business hours.
              </FieldDescription>
            </FieldContent>
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            orientation="horizontal"
            className="flex-col gap-2 sm:flex-row sm:items-start"
          >
            <FieldContent>
              <FieldTitle>Focus Threshold</FieldTitle>
              <FieldDescription>
                Controls which emails trigger focus mode notifications.
              </FieldDescription>
            </FieldContent>
            <RadioGroup
              value={focusLevel}
              onValueChange={handleFocusChange}
              className="flex flex-col gap-2"
            >
              {FOCUS_LEVELS.map((level) => (
                <Label
                  key={level.value}
                  htmlFor={`focus-${level.value}`}
                  className="border-border hover:bg-muted/50 has-[[data-checked]]:border-primary/30 has-[[data-checked]]:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
                >
                  <RadioGroupItem
                    value={level.value}
                    id={`focus-${level.value}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{level.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {level.description}
                    </span>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Personalization</CardTitle>
          <CardDescription>
            Teach Helm how to prioritize, write, and protect important senders.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldTitle>Working hours</FieldTitle>
              <FieldDescription>Used for meeting suggestions.</FieldDescription>
              <Input
                value={workHours}
                onChange={(event) => setWorkHours(event.target.value)}
                placeholder="09:00-17:00"
              />
            </Field>
            <Field>
              <FieldTitle>Automation comfort</FieldTitle>
              <FieldDescription>How conservative Helm should be.</FieldDescription>
              <Select
                value={automationComfort}
                onValueChange={(value) => value && setAutomationComfort(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Review every write">
                    Review every write
                  </SelectItem>
                  <SelectItem value="Suggest, do not execute">
                    Suggest, do not execute
                  </SelectItem>
                  <SelectItem value="Allow safe cleanup drafts">
                    Allow safe cleanup drafts
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field>
            <FieldTitle>Writing tone</FieldTitle>
            <FieldDescription>
              Used by the reply studio and agent drafts.
            </FieldDescription>
            <Input
              value={writingTone}
              onChange={(event) => setWritingTone(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldTitle>VIP contacts</FieldTitle>
              <FieldDescription>One email or name per line.</FieldDescription>
              <Textarea
                value={vipContacts}
                onChange={(event) => setVipContacts(event.target.value)}
                rows={5}
              />
            </Field>
            <Field>
              <FieldTitle>Protected senders</FieldTitle>
              <FieldDescription>Never auto-archive these senders.</FieldDescription>
              <Textarea
                value={protectedSenders}
                onChange={(event) => setProtectedSenders(event.target.value)}
                rows={5}
              />
            </Field>
          </div>
          <div>
            <Button
              onClick={savePersonalization}
              disabled={setTriagePrefs.isPending}
            >
              {setTriagePrefs.isPending ? "Saving..." : "Save personalization"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
