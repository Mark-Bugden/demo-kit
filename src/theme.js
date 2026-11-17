// The active colour theme. The site may pin one with <html data-theme="light|dark">;
// otherwise the OS preference (prefers-color-scheme) decides.

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Returns "light" or "dark". */
export function getTheme() {
  const pinned = document.documentElement.getAttribute('data-theme');
  if (pinned === 'light' || pinned === 'dark') return pinned;
  return globalThis.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Calls `callback(theme)` whenever the active theme changes, from either the OS setting
 * or the site's data-theme attribute. Returns a function that stops listening.
 */
export function onThemeChange(callback) {
  let current = getTheme();
  const check = () => {
    const next = getTheme();
    if (next !== current) {
      current = next;
      callback(next);
    }
  };
  const media = globalThis.matchMedia?.(DARK_QUERY);
  media?.addEventListener('change', check);
  const observer = new MutationObserver(check);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    media?.removeEventListener('change', check);
    observer.disconnect();
  };
}

/**
 * Reads a design token as a concrete value, for drawing on a canvas, e.g.
 * token(stage, '--color-accent'). `el` must sit inside the demo's mount element.
 */
export function token(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}
