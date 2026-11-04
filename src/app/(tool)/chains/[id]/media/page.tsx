import Link from "next/link";
import { notFound } from "next/navigation";
import { getChain, isId, listChainMedia } from "@/lib/data/chains";
import { PageHeader } from "@/components/card";
import { Thumb } from "@/components/thumb";
import { fmtDateTime } from "@/components/format";

const KIND_LABELS: Record<string, string> = {
  test: "Test run",
  upload: "Upload",
  regenerate: "Encore",
  iotd: "Image of the Day",
};

export default async function ChainMediaPage({ params, searchParams }: PageProps<"/chains/[id]/media">) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const sp = await searchParams;
  const rawPage = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  // getChain / listChainMedia run requireSuperadmin() before reading anything.
  const [found, media] = await Promise.all([getChain(id), listChainMedia(id, page)]);
  if (!found) notFound();
  const { runs, total, pageSize } = media;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Link href="/" className="hover:text-foreground">
          Prompt chains
        </Link>
        <span>/</span>
        <Link href={`/chains/${id}`} className="font-mono hover:text-foreground">
          {found.chain.slug}
        </Link>
        <span>/</span>
        <span>Media</span>
      </div>
      <PageHeader title={`Media from ${found.chain.slug}`} />
      <p className="-mt-4 text-sm text-ink-secondary">
        {total.toLocaleString()} run{total === 1 ? "" : "s"}: test runs from this tool, plus captions the original app
        generated with this chain.
      </p>

      {runs.length === 0 ? (
        <p className="rounded-xl border border-hairline bg-surface px-4 py-10 text-center text-sm text-ink-muted">
          Nothing generated yet.{" "}
          <Link href={`/chains/${id}`} className="underline">
            Run the chain
          </Link>{" "}
          to see results here.
        </p>
      ) : (
        <ul className="space-y-3">
          {runs.map((r) => (
            <li key={r.id} className="flex gap-4 rounded-xl border border-hairline bg-surface p-4">
              <Thumb src={r.imageUrl} size="md" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <span className="rounded bg-foreground/10 px-1.5 py-0.5 font-medium text-ink-secondary">
                    {(r.kind && KIND_LABELS[r.kind]) ?? r.kind ?? "Run"}
                  </span>
                  <span>{fmtDateTime(r.created_at)}</span>
                  <span>Run #{r.id}</span>
                  {r.failed && <span className="text-danger">Failed</span>}
                </div>
                {r.caption && (
                  <p className="font-medium">
                    <span className="text-xs font-normal text-ink-muted">Caption: </span>
                    {r.caption}
                  </p>
                )}
                {r.finalOutput && (!r.caption || r.caption !== r.finalOutput) && (
                  <p className={`whitespace-pre-wrap text-sm ${r.failed ? "text-danger" : ""}`}>{r.finalOutput}</p>
                )}
                {r.responses.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-ink-muted">
                      All {r.responses.length} step output{r.responses.length === 1 ? "" : "s"}
                    </summary>
                    <ol className="mt-2 space-y-2 border-l border-hairline pl-3">
                      {r.responses.map((s) => (
                        <li key={s.id}>
                          <div className="text-xs text-ink-muted">
                            {s.stepLabel} · {s.processing_time_seconds}s
                          </div>
                          <p className={`whitespace-pre-wrap ${s.error ? "text-danger" : "text-ink-secondary"}`}>
                            {s.error ?? s.llm_model_response}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-ink-secondary">
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/chains/${id}/media${page > 2 ? `?page=${page - 1}` : ""}`}
                className="rounded-md border border-hairline px-3 py-1.5 hover:bg-foreground/5"
              >
                Previous
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/chains/${id}/media?page=${page + 1}`}
                className="rounded-md border border-hairline px-3 py-1.5 hover:bg-foreground/5"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
