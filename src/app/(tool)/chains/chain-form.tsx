"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import { inputCls } from "@/components/field";

export function ChainForm({
  action,
  initial,
  submitLabel,
  savedLabel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  initial?: { slug: string; description: string | null };
  submitLabel: string;
  /** Shown after a successful save that stays on the page (edit). */
  savedLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  // A new state object with no error means the last submit succeeded.
  const saved = savedLabel && !pending && state !== INITIAL && state.error === null;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <div className="space-y-1">
          <label htmlFor="slug" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="slug"
            name="slug"
            required
            defaultValue={initial?.slug}
            placeholder="e.g. dad-jokes"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Lowercase words joined by hyphens"
            className={`${inputCls} font-mono`}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm font-medium">
            Description <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <input
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
            placeholder="What kind of captions this chain writes"
            className={inputCls}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {saved && <span className="text-sm text-ink-secondary">{savedLabel}</span>}
        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

const INITIAL: ActionState = { error: null };
