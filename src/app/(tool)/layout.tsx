import Link from "next/link";
import { requireSuperadmin } from "@/lib/dal";
import { signOut } from "@/app/actions";
import { Avatar } from "@/components/thumb";
import { ThemeToggle } from "@/components/theme-toggle";

// Layouts don't re-render on every client navigation, so this is not the
// gate: each page and data function calls requireSuperadmin() itself.
export default async function ToolLayout({ children }: LayoutProps<"/">) {
  const admin = await requireSuperadmin();
  const name = [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.email || "Admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-x-6 px-4 py-3 sm:px-6">
          <Link href="/" className="font-semibold">
            🎤 Open Mic AI <span className="font-normal text-ink-muted">Prompt Chains</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-secondary">
            <ThemeToggle />
            <Avatar src={admin.avatar_url} name={name} />
            <span className="hidden sm:inline">{admin.email}</span>
            <form action={signOut}>
              <button className="rounded-md px-2 py-1 hover:bg-foreground/5 hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
