// The active colour theme. Dark by default, as on the site, whatever the OS prefers; light only
// when the page sets <html data-theme="light">, as the site's theme switch does.

/** Returns "light" or "dark". */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * Calls `callback(theme)` whenever the active theme changes, i.e. when the page's data-theme
 * attribute switches between light and anything else. Returns a function that stops listening.
 */
export function onThemeChange(callback) {
  let current = getTheme();
  const observer = new MutationObserver(() => {
    const next = getTheme();
    if (next !== current) {
      current = next;
      callback(next);
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/**
 * Reads a design token as a concrete value, for drawing on a canvas, e.g.
 * token(stage, '--color-accent'). `el` must sit inside the demo's mount element.
 */
export function token(el, name) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}
