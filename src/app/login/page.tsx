import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/dal";
import { GoogleSignInButton } from "@/components/google-sign-in-button";

const ERRORS: Record<string, string> = {
  missing_code: "Sign-in was cancelled or didn't complete.",
  auth_failed: "Couldn't finish signing in. Try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSignedInUser()) redirect("/");

  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Open Mic AI · Prompt Chains</h1>
      <p className="text-sm text-ink-secondary">Superadmins only. Sign in with Google to continue.</p>
      {message && <p className="text-sm text-red-500">{message}</p>}
      <GoogleSignInButton />
    </main>
  );
}
