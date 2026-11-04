"use client";

import { useActionState } from "react";

type ActionState = { error: string | null };

/**
 * A one-click Server Action (move, delete…) that shows its { error } inline.
 * Pass `confirm` to ask before running it.
 */
export function ActionButton({
  action,
  children,
  confirm: confirmText,
  pendingLabel,
  className = "rounded-md border border-hairline px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-40",
  disabled,
  title,
}: {
  action: (prev: ActionState) => Promise<ActionState>;
  children: React.ReactNode;
  confirm?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <button disabled={pending || disabled} className={className} title={title} aria-label={title}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {state.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
