import { requireSuperadmin } from "@/lib/dal";
import { PageHeader } from "@/components/card";

export default async function ChainsPage() {
  await requireSuperadmin();
  return (
    <div>
      <PageHeader title="Prompt chains" />
      <p className="text-sm text-ink-secondary">Coming soon: create, edit, reorder and run prompt chains.</p>
    </div>
  );
}
