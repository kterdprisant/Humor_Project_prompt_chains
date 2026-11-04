import Link from "next/link";
import { notFound } from "next/navigation";
import { getChain, isId, listModels } from "@/lib/data/chains";
import { Card } from "@/components/card";
import { ActionButton } from "@/components/action-button";
import { ChainForm } from "../chain-form";
import { RunPanel } from "../run-panel";
import { deleteChain, deleteStep, moveStep, runChainAction, updateChain } from "../actions";

// A test run makes one model call per step; give Server Actions on this page
// room for a few slow steps.
export const maxDuration = 120;

export default async function ChainPage({ params }: PageProps<"/chains/[id]">) {
  const { id } = await params;
  if (!isId(id)) notFound();

  // getChain / listModels run requireSuperadmin() before reading anything.
  const [found, models] = await Promise.all([getChain(id), listModels()]);
  if (!found) notFound();
  const { chain, steps, mixWeight } = found;
  const modelName = new Map(models.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Link href="/" className="hover:text-foreground">
          Prompt chains
        </Link>
        <span>/</span>
        <span className="font-mono">{chain.slug}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{chain.slug}</h1>
          <p className="text-sm text-ink-secondary">
            {mixWeight === null
              ? "Not in the original app's mix, so it only runs from this tool."
              : mixWeight === 0
                ? "In the mix with weight 0 (off)."
                : `In the original app's mix with weight ${mixWeight}.`}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Link
            href={`/chains/${id}/media`}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:bg-foreground/5"
          >
            View media
          </Link>
          <ActionButton
            action={deleteChain.bind(null, id)}
            confirm={`Delete “${chain.slug}” and all ${steps.length} of its steps? Past runs stay in the logs.`}
            pendingLabel="Deleting…"
            className="rounded-md border border-danger/50 px-3 py-1.5 text-sm hover:bg-danger/10 disabled:opacity-50"
          >
            Delete chain
          </ActionButton>
        </div>
      </div>

      <Card title="Details">
        <ChainForm
          action={updateChain.bind(null, id)}
          initial={chain}
          submitLabel="Save"
          savedLabel="Saved."
        />
      </Card>

      <Card
        title={`Steps (${steps.length})`}
        subtitle="Run top to bottom. Use the arrows to reorder."
        action={
          <Link
            href={`/chains/${id}/steps/new`}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background"
          >
            Add step
          </Link>
        }
      >
        {steps.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No steps yet. A typical chain: 1) describe the image, 2) find what&apos;s funny about it, 3) write five
            short captions.
          </p>
        ) : (
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 rounded-lg border border-hairline p-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold tabular-nums">
                    {s.order_by}
                  </span>
                  <ActionButton action={moveStep.bind(null, id, String(s.id), -1)} disabled={i === 0} title="Move up">
                    ↑
                  </ActionButton>
                  <ActionButton
                    action={moveStep.bind(null, id, String(s.id), 1)}
                    disabled={i === steps.length - 1}
                    title="Move down"
                  >
                    ↓
                  </ActionButton>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{s.description || <span className="text-ink-muted">Untitled step</span>}</span>
                    <span className="text-xs text-ink-muted">
                      {modelName.get(s.llm_model_id) ?? `model #${s.llm_model_id}`}
                      {s.llm_temperature !== null ? ` · temp ${s.llm_temperature}` : ""}
                      {i === 0 ? " · receives the image" : ""}
                    </span>
                  </div>
                  {s.llm_system_prompt && (
                    <p className="line-clamp-2 font-mono text-xs text-ink-muted">System: {s.llm_system_prompt}</p>
                  )}
                  <p className="line-clamp-3 whitespace-pre-wrap font-mono text-xs text-ink-secondary">{s.llm_user_prompt}</p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/chains/${id}/steps/${s.id}`}
                      className="rounded-md border border-hairline px-2 py-1 text-xs hover:bg-foreground/5"
                    >
                      Edit
                    </Link>
                    <ActionButton
                      action={deleteStep.bind(null, id, String(s.id))}
                      confirm={`Delete step ${s.order_by}? Later steps move up one.`}
                      className="rounded-md border border-danger/50 px-2 py-1 text-xs hover:bg-danger/10 disabled:opacity-50"
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Generate" subtitle="Run this chain on a test image. Each run is logged and appears under View media.">
        <RunPanel action={runChainAction.bind(null, id)} chainId={chain.id} hasSteps={steps.length > 0} />
      </Card>
    </div>
  );
}
