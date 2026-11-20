# Changelog

Each release is a tag `v<major>.<minor>.<patch>` on `main`. A change that breaks the bundle contract (a renamed manifest key, a changed mount API) is a major version and is marked **Breaking**.

## 0.5.0

A brighter light accent. The bundle contract and the API are unchanged.

- **The light main highlight**, `--color-accent`, is now Cherenkov blue (`#2456d3`, 6.3:1 on the surface) in place of viridis blue (`#285388`), which read as dull grey beside the text. Dark is unchanged.
- **The highlights' separation is relaxed for tritanopia only:** at least 0.13 in OKLab (measured 0.136), and still 0.2 with normal vision, protanopia and deuteranopia (measured 0.318 at worst on light). No bright blue keeps 0.2 from the green with tritanopia, which is rare.
- Light chart slots 1 (`#2a78d6` → `#338ed4`) and 7 (`#5d1cb6` → `#6708b5`) move, to stay ΔE 15 from the new accent.
- The light spectrum is unchanged, so `#285388` stays its second stop.

## 0.4.0

A shared palette. Each theme has three colour roles, which the site uses too. The bundle contract is unchanged, but the light accent changes, two tokens are gone and continuous chart colours change.

- **The main highlight**, `--color-accent`, keeps its name, so demos pick it up without changes. Dark is still sodium amber (`#f6be55`). Light is now viridis blue (`#285388`, 7.8:1 on the surface) in place of H-alpha red. It's the only role that may carry text.
- **The contrasting highlight**, `--color-accent-2`, is new: ember red (`#c13c36`) on dark and green (`#5ca24c`) on light. It's for a second group beside the first, drawn as dots, lines and fills. It clears 3:1 on the surface (3.4:1 dark, 3.1:1 light) but not 4.5:1, so never use it for text. The two highlights stay at least 0.2 apart in OKLab with each colour-vision deficiency.
- **The spectrum**, `--chart-spectrum-1` to `--chart-spectrum-4`, replaces the one-hue sequential ramp: **`--chart-seq-low` and `--chart-seq-high` are gone.** Dark is "ember" (`#c13c36 #ea6a12 #f6be55 #f9f0ba`) and light is "viridis" (`#35226a #285388 #0f8080 #5ca24c`). Lighter is higher in both. `plot()` now runs continuous colour scales through it.
- **Colour maths**, in `@mark-bugden/demo-kit/colour`: `ramp()` interpolates through several stops in OKLab, and `contrast()`, `simulate()` and `distance()` check a palette. They come from doctor-who-ratings, whose heatmap the spectrum was made for, and so do the spectrum's tests.
- Light chart slot 7 moves from `#4a3aa7` to `#5d1cb6`, to stay ΔE 15 from the new accent. The tests now check this for every slot.
- `--color-sodium` and `--color-halpha` are unchanged.

## 0.3.0

Light-theme images. The bundle contract gains two optional files; bundles without them are unchanged.

- `thumb-light.webp` and `static-light.webp`: light-theme versions of the project card image and the loading still, which the site shows under its light theme. The validator holds them to the same rules as `thumb.webp` (1200×675 px WebP, under 80 KB) and `static.webp` (WebP), and `static-light.webp` to the same size as `static.webp`, since it swaps in for it.

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
