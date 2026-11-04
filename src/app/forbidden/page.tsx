import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/dal";
import { signOut } from "@/app/actions";

export default async function ForbiddenPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Not authorized</h1>
      <p className="text-sm text-ink-secondary">
        You&apos;re signed in as <span className="font-medium">{user.email}</span>, but this
        account isn&apos;t a superadmin.
      </p>
      <form action={signOut}>
        <button className="rounded-md border border-hairline px-4 py-2 text-sm hover:bg-foreground/5">
          Sign out
        </button>
      </form>
    </main>
  );
}
