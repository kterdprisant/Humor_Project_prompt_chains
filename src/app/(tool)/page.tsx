import Link from "next/link";
import { listChains } from "@/lib/data/chains";
import { Card, PageHeader, tableCls } from "@/components/card";
import { fmtDate } from "@/components/format";
import { ChainForm } from "./chains/chain-form";
import { createChain } from "./chains/actions";

export default async function ChainsPage() {
  // listChains runs requireSuperadmin() before reading anything.
  const chains = await listChains();

  return (
    <div className="space-y-6">
      <PageHeader title="Prompt chains" />
      <p className="-mt-4 max-w-3xl text-sm text-ink-secondary">
        Each chain is an ordered list of LLM steps. Step 1 sees the image, and each later step works from the previous
        step&apos;s output. The original app picks which chain to run by its mix weight, which you set in the admin area.
      </p>

      <Card title="New prompt chain">
        <ChainForm action={createChain} submitLabel="Create chain" />
      </Card>

      <div className={tableCls.wrap}>
        <table className={tableCls.table}>
          <thead>
            <tr>
              <th className={tableCls.th}>Chain</th>
              <th className={tableCls.th}>Steps</th>
              <th className={tableCls.th}>Runs</th>
              <th className={tableCls.th}>Mix weight</th>
              <th className={tableCls.th}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => (
              <tr key={c.id} className="hover:bg-foreground/[0.03]">
                <td className={tableCls.td}>
                  <Link href={`/chains/${c.id}`} className="font-mono font-medium hover:underline">
                    {c.slug}
                  </Link>
                  {c.description && <p className="line-clamp-1 max-w-lg text-ink-secondary">{c.description}</p>}
                </td>
                <td className={`${tableCls.td} tabular-nums`}>{c.stepCount}</td>
                <td className={`${tableCls.td} tabular-nums`}>
                  {c.runCount > 0 ? (
                    <Link href={`/chains/${c.id}/media`} className="hover:underline">
                      {c.runCount}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td className={`${tableCls.td} tabular-nums text-ink-secondary`}>
                  {c.mixWeight === null ? "Not in mix" : c.mixWeight === 0 ? "Off (0)" : c.mixWeight}
                </td>
                <td className={`${tableCls.td} whitespace-nowrap text-ink-secondary`}>{fmtDate(c.updated_at)}</td>
              </tr>
            ))}
            {chains.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  No prompt chains yet. Create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
