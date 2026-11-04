import Link from "next/link";
import { notFound } from "next/navigation";
import { getChain, isId, listModels } from "@/lib/data/chains";
import { PageHeader } from "@/components/card";
import { StepForm } from "../../../step-form";
import { createStep } from "../../../actions";

export default async function NewStepPage({ params }: PageProps<"/chains/[id]/steps/new">) {
  const { id } = await params;
  if (!isId(id)) notFound();

  // getChain / listModels run requireSuperadmin() before reading anything.
  const [found, models] = await Promise.all([getChain(id), listModels()]);
  if (!found) notFound();

  return (
    <div>
      <div className="mb-2 text-sm text-ink-muted">
        <Link href={`/chains/${id}`} className="font-mono hover:text-foreground">
          {found.chain.slug}
        </Link>
      </div>
      <PageHeader title={`New step ${found.steps.length + 1}`} />
      <StepForm
        action={createStep.bind(null, id)}
        models={models}
        order={found.steps.length + 1}
        cancelHref={`/chains/${id}`}
        submitLabel="Add step"
      />
    </div>
  );
}
