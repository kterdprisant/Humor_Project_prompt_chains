// Fallback for the (tool) loading.tsx boundaries. The root loading.tsx sits
// above the (tool) layout, so it never shows during client navigations
// between tool pages; without these, those navigations block on the page's
// data instead of rendering instantly.
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 rounded-md bg-foreground/10" />
      <div className="h-4 w-96 max-w-full rounded-md bg-foreground/5" />
      <div className="h-64 rounded-xl border border-hairline bg-surface" />
    </div>
  );
}
