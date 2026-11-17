# Changelog

Each release is a tag `v<major>.<minor>.<patch>` on `main`. A change that breaks the bundle contract (a renamed manifest key, a changed mount API) is a major version and is marked **Breaking**.

## 0.1.0

First release.

- `mount()`: the standard demo frame (title and tagline, controls rail, stage, status line, "How this works", model card, links), with Play/Pause that starts paused under `prefers-reduced-motion` and stops while the stage is off screen. An embedded mode for the site (`data-embedded`) leaves out what the project page already shows.
- Controls: `slider()`, `toggle()`, `select()`, `preset()`.
- Solvers: `rk4()`, `gridDiffusion2D()`, `runInWorker()`.
- `plot()`: an Observable Plot wrapper that applies the tokens and theme; `Plot` is re-exported.
- `loadJSON()` and `loadCSV()`, relative to the demo's own folder.
- `getTheme()`, `onThemeChange()` and `token()`.
- `tokens.css` (for the site, on `:root`) and the generated `tokens.scoped.css` (for demos, on `[data-demo]`); `frame.css`.
- `demo-kit validate <dir>`: checks a bundle against the contract, including that tag `v<kitVersion>` exists.
- `template/`: a minimal demo project (Vite) that builds a valid bundle.
