"use client";

import { useSyncExternalStore } from "react";
import { THEMES, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function write(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode etc.): still apply for this page view.
  }
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeToggle() {
  // Server render has no storage; "system" until hydrated.
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  return (
    <div role="radiogroup" aria-label="Color theme" className="flex rounded-md border border-hairline p-0.5 text-xs">
      {THEMES.map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={theme === t}
          onClick={() => write(t)}
          className={`rounded px-2 py-1 ${
            theme === t ? "bg-foreground/10 font-medium text-foreground" : "text-ink-secondary hover:text-foreground"
          }`}
        >
          {LABELS[t]}
        </button>
      ))}
    </div>
  );
}
