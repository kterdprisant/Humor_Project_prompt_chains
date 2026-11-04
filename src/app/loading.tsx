// Root Suspense boundary. With Cache Components on, this spinner is the only
// thing in each route's prerendered static shell; everything else (including
// the tool chrome) renders after the session/superadmin check at request time.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
      Loading…
    </div>
  );
}
