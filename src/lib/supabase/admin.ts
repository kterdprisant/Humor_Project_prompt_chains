import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. RLS is bypassed, so this is what lets the tool read
 * and edit every prompt chain.
 *
 * Only call it from functions in src/lib/dal.ts or src/lib/data/*, and only
 * after requireSuperadmin() / getActionAdmin() has succeeded. Every query
 * must be scoped deliberately: nothing here is filtered for you. Never import
 * this from a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
