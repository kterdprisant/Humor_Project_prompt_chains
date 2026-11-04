"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-foreground/10 font-medium text-foreground"
          : "text-ink-secondary hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
