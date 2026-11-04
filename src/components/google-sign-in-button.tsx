"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <button
      onClick={handleSignIn}
      className="rounded-md bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
    >
      Continue with Google
    </button>
  );
}
