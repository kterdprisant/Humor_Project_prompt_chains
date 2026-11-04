// Theme preference: "system" (follow the OS) or an explicit override.
// Stored per browser in localStorage and reflected as <html data-theme>.
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = "theme";

// Runs in <head> before first paint so an explicit choice never flashes the
// wrong theme. "system" leaves data-theme unset and the CSS media query decides.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
