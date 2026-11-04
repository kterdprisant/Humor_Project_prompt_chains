import Link from "next/link";
import { notFound } from "next/navigation";
import { getChain, getStep, isId, listModels } from "@/lib/data/chains";
import { PageHeader } from "@/components/card";
import { StepForm } from "../../../step-form";
import { updateStep } from "../../../actions";

export default async function EditStepPage({ params }: PageProps<"/chains/[id]/steps/[stepId]">) {
  const { id, stepId } = await params;
  if (!isId(id) || !isId(stepId)) notFound();

  // getChain / getStep / listModels run requireSuperadmin() before reading anything.
  const [found, step, models] = await Promise.all([getChain(id), getStep(id, stepId), listModels()]);
  if (!found || !step) notFound();

  return (
    <div>
      <div className="mb-2 text-sm text-ink-muted">
        <Link href={`/chains/${id}`} className="font-mono hover:text-foreground">
          {found.chain.slug}
        </Link>
      </div>
      <PageHeader title={`Edit step ${step.order_by}`} />
      <StepForm
        action={updateStep.bind(null, id, stepId)}
        models={models}
        initial={step}
        order={step.order_by}
        cancelHref={`/chains/${id}`}
        submitLabel="Save step"
      />
    </div>
  );
}
