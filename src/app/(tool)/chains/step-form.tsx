"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { ActionState } from "./actions";
import type { ModelOption, Step } from "@/lib/data/chains";
import { Field, inputCls } from "@/components/field";

export function StepForm({
  action,
  models,
  initial,
  order,
  cancelHref,
  submitLabel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  models: ModelOption[];
  initial?: Step;
  /** This step's position, to explain what {input} will be. */
  order: number;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [modelId, setModelId] = useState(String(initial?.llm_model_id ?? models[0]?.id ?? ""));
  const model = models.find((m) => String(m.id) === modelId);

  return (
    <form action={formAction} className="max-w-3xl space-y-5 rounded-xl border border-hairline bg-surface p-6">
      <Field label="Description" htmlFor="description" optional hint="A short label, e.g. “Describe the image”.">
        <input id="description" name="description" defaultValue={initial?.description ?? ""} className={inputCls} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Field label="Model" htmlFor="llm_model_id">
          {models.length === 0 ? (
            <p className="text-sm text-danger">No models yet. Add one in the admin area under LLM models.</p>
          ) : (
            <select
              id="llm_model_id"
              name="llm_model_id"
              required
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className={inputCls}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.provider ? ` (${m.provider})` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Temperature"
          htmlFor="llm_temperature"
          optional
          hint={model && !model.is_temperature_supported ? "Ignored: this model doesn't support it." : "0–2"}
        >
          <input
            id="llm_temperature"
            name="llm_temperature"
            type="number"
            step="0.1"
            min={0}
            max={2}
            defaultValue={initial?.llm_temperature ?? ""}
            disabled={model && !model.is_temperature_supported}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="System prompt" htmlFor="llm_system_prompt" optional hint="Instructions for the model's role and style.">
        <textarea
          id="llm_system_prompt"
          name="llm_system_prompt"
          rows={3}
          defaultValue={initial?.llm_system_prompt ?? ""}
          className={`${inputCls} font-mono text-xs`}
        />
      </Field>

      <Field
        label="User prompt"
        htmlFor="llm_user_prompt"
        hint={
          order === 1 ? (
            <>
              Step 1 receives the uploaded image along with this prompt. <code>{"{input}"}</code> is replaced with the
              text input, if you run the chain on text instead.
            </>
          ) : (
            <>
              <code>{"{input}"}</code> is replaced with step {order - 1}&apos;s output.
            </>
          )
        }
      >
        <textarea
          id="llm_user_prompt"
          name="llm_user_prompt"
          required
          rows={7}
          defaultValue={initial?.llm_user_prompt ?? (order === 1 ? "" : "Here is the previous output:\n\n{input}\n\n")}
          className={`${inputCls} font-mono text-xs`}
        />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          disabled={pending || models.length === 0}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={cancelHref} className="rounded-md px-4 py-2 text-sm text-ink-secondary hover:bg-foreground/5">
          Cancel
        </Link>
      </div>
    </form>
  );
}
