import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The superadmin gate. Every page, every function in src/lib/data/*,
 * and every Server Action must pass through requireSuperadmin() or
 * getActionAdmin() before touching data. proxy.ts only checks for a session.
 */

export type AdminProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type GateResult =
  | { status: "anonymous" }
  | { status: "forbidden"; user: User }
  | { status: "ok"; user: User; profile: AdminProfile };

const checkGate = cache(async (): Promise<GateResult> => {
  // Request time only. With partialPrefetching, cookies() also resolves in the
  // App Shell prefetch pass, and Supabase's getUser() reads Date.now() to
  // check token expiry, which Next blocks there ("blocking-prerender-current-time").
  // The gate must run against a real request anyway.
  await connection();
  const supabase = await createClient();
  // getUser() validates the JWT with Supabase Auth; never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anonymous" };

  // Scoped to the verified user's own id. Any error or missing row fails closed.
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_url, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || data?.is_superadmin !== true) {
    if (error) console.error("superadmin check failed:", error.message);
    return { status: "forbidden", user };
  }

  const { id, email, first_name, last_name, avatar_url } = data;
  return { status: "ok", user, profile: { id, email, first_name, last_name, avatar_url } };
});

/** For Server Components and data functions: redirects unless superadmin. */
export async function requireSuperadmin(): Promise<AdminProfile> {
  const gate = await checkGate();
  if (gate.status === "anonymous") redirect("/login");
  if (gate.status === "forbidden") redirect("/forbidden");
  return gate.profile;
}

/**
 * For Server Actions: returns {error} instead of redirecting/throwing, per the
 * project convention (thrown action errors are redacted in production).
 */
export async function getActionAdmin(): Promise<
  { admin: AdminProfile; error: null } | { admin: null; error: string }
> {
  const gate = await checkGate();
  if (gate.status !== "ok") return { admin: null, error: "Not authorized." };
  return { admin: gate.profile, error: null };
}

/** The signed-in user regardless of admin status (for /forbidden). */
export async function getSignedInUser() {
  const gate = await checkGate();
  return gate.status === "anonymous" ? null : gate.user;
}
