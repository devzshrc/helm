"use client";

import { api } from "~/trpc/react";
import type { FieldDescriptor } from "~/lib/workflows/types";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";

/** Renders a config form from field descriptors. */
export function ConfigForm({
  fields,
  values,
  onChange,
  variables = [],
  errors = {},
}: {
  fields: FieldDescriptor[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  variables?: string[];
  errors?: Record<string, string>;
}) {
  const labels = api.mail.labels.useQuery(undefined, { staleTime: 5 * 60_000 });

  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No options for this step.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <Field key={f.key}>
          <FieldLabel htmlFor={`cfg-${f.key}`}>
            {f.label}
            {f.optional ? (
              <span className="text-muted-foreground"> (optional)</span>
            ) : null}
          </FieldLabel>

          {f.type === "select" ? (
            <NativeSelect
              id={`cfg-${f.key}`}
              className="w-full"
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            >
              <NativeSelectOption value="">Choose…</NativeSelectOption>
              {f.options?.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : f.type === "textarea" ? (
            <Textarea
              id={`cfg-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={4}
            />
          ) : f.type === "label" ? (
            <>
              <Input
                id={`cfg-${f.key}`}
                list="wf-labels"
                value={values[f.key] ?? ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
              <datalist id="wf-labels">
                {(labels.data ?? []).map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </>
          ) : (
            <Input
              id={`cfg-${f.key}`}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          )}
          {errors[f.key] ? (
            <p className="text-destructive text-xs">{errors[f.key]}</p>
          ) : null}
          {variables.length > 0 && ["text", "textarea"].includes(f.type) ? (
            <div className="flex flex-wrap gap-1">
              {variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() =>
                    onChange(
                      f.key,
                      `${values[f.key] ?? ""}${values[f.key] ? " " : ""}${variable}`,
                    )
                  }
                  className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-2 py-0.5 text-[11px] transition-colors"
                >
                  {variable}
                </button>
              ))}
            </div>
          ) : null}
        </Field>
      ))}
    </div>
  );
}
