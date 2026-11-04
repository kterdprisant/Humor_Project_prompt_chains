"use client";

/* eslint-disable @next/next/no-img-element -- the preview is a local blob: URL */

import { useActionState, useState } from "react";
import Link from "next/link";
import type { RunState } from "./actions";
import { inputCls } from "@/components/field";

export function RunPanel({
  action,
  chainId,
  hasSteps,
}: {
  action: (prev: RunState, form: FormData) => Promise<RunState>;
  chainId: number;
  hasSteps: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [preview, setPreview] = useState<string | null>(null);
  const steps = state.result?.steps ?? [];
  const output = state.result && state.result.error === null ? state.result.output : null;

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div className="flex flex-wrap items-start gap-4">
          <label className="flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-hairline text-center text-xs text-ink-muted hover:bg-foreground/5">
            {preview ? <img src={preview} alt="Selected" className="h-full w-full object-cover" /> : "Choose image"}
            <input
              type="file"
              name="image"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview((old) => {
                  if (old) URL.revokeObjectURL(old);
                  return f ? URL.createObjectURL(f) : null;
                });
              }}
            />
          </label>
          <div className="min-w-0 flex-1 space-y-2">
            <textarea
              name="text"
              rows={3}
              placeholder="…or run on text instead (fills {input} in step 1)"
              className={inputCls}
            />
            <div className="flex items-center gap-3">
              <button
                disabled={pending || !hasSteps}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {pending ? "Running…" : "Generate"}
              </button>
              <span className="text-xs text-ink-muted">
                {hasSteps ? "One model call per step. Gemini's free tier allows 5 a minute." : "Add a step first."}
              </span>
            </div>
          </div>
        </div>
      </form>

      {state.error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}

      {output && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Final output</div>
          <p className="whitespace-pre-wrap">{output}</p>
        </div>
      )}

      {steps.length > 0 && (
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.order} className="rounded-lg border border-hairline p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  Step {s.order}
                  {s.description ? ` · ${s.description}` : ""}
                </span>
                <span className="text-xs text-ink-muted">
                  {s.model} · {s.seconds}s
                </span>
              </div>
              {s.error ? (
                <p className="mt-1 text-danger">{s.error}</p>
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-ink-secondary">{s.output}</p>
              )}
              <details className="mt-2 text-xs text-ink-muted">
                <summary className="cursor-pointer">Prompt sent</summary>
                <pre className="mt-1 whitespace-pre-wrap font-mono">{s.userPrompt}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}

      {state.result && (
        <Link href={`/chains/${chainId}/media`} className="inline-block text-sm text-ink-secondary hover:text-foreground">
          See all media from this chain →
        </Link>
      )}
    </div>
  );
}
