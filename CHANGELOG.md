# Changelog

Each release is a tag `v<major>.<minor>.<patch>` on `main`. A change that breaks the bundle contract (a renamed manifest key, a changed mount API) is a major version and is marked **Breaking**.

## 0.2.0

Design tokens for the site's phase portrait design, so demos match the pages they sit on. The bundle contract and the API are unchanged, but **dark is now the default theme**.

- **Dark by default, as on the site.** A demo is dark unless `<html data-theme="light">`, whatever the OS prefers, so a standalone demo is always dark. `getTheme()` returns `'dark'` unless that attribute is `"light"`, and `onThemeChange()` no longer listens to `prefers-color-scheme`. When a demo moves to this version, its own theme-dependent CSS should follow suit: dark values on `[data-demo]`, light ones under `:root[data-theme="light"] [data-demo]`, and no `prefers-color-scheme`.
- Colours from the site: `--color-bg`, `--color-surface`, `--color-text`, `--color-muted`, `--color-border` and `--color-accent` take its `bg`, `panel`, `fg`, `muted`, `line` and `accent`. The accent is sodium amber (`#f6be55`) on dark and H-alpha red (`#c2391b`) on light, and `--color-on-accent` clears 4.5:1 on both.
- New tokens: `--color-curve` (the site's `curve`), and `--color-sodium` and `--color-halpha`, which are the same in both themes.
- Type: Space Grotesk for display, Inter for text and JetBrains Mono for code, each with system fallbacks. `--weight-display` is 500 (was 650), as on the site's headings.
- Chart palette re-stepped for the new surfaces and accents. It keeps the same eight hues in the same order. Light slots 2, 3, 4, 5 and 8 and dark slot 2 moved, so every slot now clears 3:1 on the surface in both themes, and no slot sits within ΔE 15 of its theme's accent. The sequential ramp is unchanged.
- Embedded (`data-embedded`), the frame no longer paints a background, so it shows no seam against the page. Standalone, it still fills the window with `--color-bg`.
- Template: placeholder images redrawn in the new palette, and `<meta name="color-scheme">` is `dark`.

## 0.1.0

First release.

- `mount()`: the standard demo frame (title and tagline, controls rail, stage, status line, "How this works", an optional model card, links), with Play/Pause that starts paused under `prefers-reduced-motion` and stops while the stage is off screen. An embedded mode for the site (`data-embedded`) leaves out what the project page already shows.
- Controls: `slider()`, `toggle()`, `select()`, `preset()`.
- Solvers: `rk4()`, `gridDiffusion2D()`, `runInWorker()`.
- `plot()`: an Observable Plot wrapper that applies the tokens and theme; `Plot` is re-exported.
- `loadJSON()` and `loadCSV()`, relative to the demo's own folder.
- `getTheme()`, `onThemeChange()` and `token()`.
- `tokens.css` (for the site, on `:root`) and the generated `tokens.scoped.css` (for demos, on `[data-demo]`); `frame.css`.
- `demo-kit validate <dir>`: checks a bundle against the contract, including that tag `v<kitVersion>` exists. `modelCard` is optional.
- `template/`: a minimal demo project (Vite) that builds a valid bundle.
