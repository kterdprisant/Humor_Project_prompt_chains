import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/update-session";

// Next.js 16 renamed Middleware to Proxy (exports `proxy`, Node.js runtime).
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Server Actions are POSTs to the page route, so they're matched too.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
