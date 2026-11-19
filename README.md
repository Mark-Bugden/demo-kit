# demo-kit

The shared library behind the interactive demos on [mark-bugden.github.io](https://mark-bugden.github.io/). It provides:

- the standard demo frame
- controls
- numerical helpers
- a chart wrapper and a data loader
- design tokens
- a validator for the bundle each project builds

Each project repo keeps its demo in `demo/`, copied from [`template/`](template/), and pins this kit to a release tag.

Plain ES modules, no build step to use it. The only runtime dependency is [Observable Plot](https://observablehq.com/plot/).

## Run it locally

```sh
git clone https://github.com/Mark-Bugden/demo-kit.git && cd demo-kit
npm install
npm test
```

## Start a demo from the template

1. Copy [`template/`](template/) to the project's `demo/` folder.
2. In `demo/package.json`, set `"name"` to `"<slug>-demo"`.
3. In `demo/public/manifest.json`, fill in every field, and set `"status": "stub"` until the demo works.
4. In `demo/index.html`, set the mount element to `data-demo="<slug>"`, and update the `<title>`, the description and the image `alt`.
5. Replace `public/static.webp`, `thumb.webp` and `og.jpg`. Sizes are in the bundle contract below.
6. Replace the placeholder controls and drawing code in `src/main.js`.
7. Run `npm install` and commit `package-lock.json`. The release workflow uses `npm ci`.

Then, in `demo/`:

```sh
npm run dev                                  # live preview at http://localhost:5173
npm run build && npx demo-kit validate dist/
npx vite preview                             # serve the built bundle at http://localhost:4173
```

Put runtime data in `public/data/` (JSON or CSV) and exported models in `public/model/` (JSON or JS). Vite copies both into the bundle unchanged.

## The bundle contract

`npm run build` produces `dist/`, which a project's release workflow zips as `demo-<slug>.zip`. The site unzips it into `/demos/<slug>/`. It must contain exactly:

| Path | What it is |
| --- | --- |
| `manifest.json` | Metadata for the site's project card, page header and, if the project has one, model card. |
| `index.html` | Runs the demo standalone from any static server, at any URL depth. Relative paths only, no inline scripts. |
| `demo.js`, `demo.css` | The built demo: one ES module and one stylesheet, with these fixed names. |
| `thumb.webp` | 1200×675 px, under 80 KB. The project card image. |
| `og.jpg` | 1200×630 px JPEG, under 150 KB. Used for link previews only. |
| `static.webp` | A still of the demo's opening state. Shown while the script loads and when JavaScript is off. |
| `thumb-light.webp`, `static-light.webp` | Optional: light-theme versions of `thumb.webp` and `static.webp`, with the same sizes and limits. The site shows them instead under its light theme. Without them, it shows the dark ones in both themes. |
| `data/`, `model/` | Optional: `.json`, `.csv` or `.js` files. The whole bundle must stay under 2 MB. |

Sizes use 1 KB = 1000 bytes.

### `manifest.json`

Every key is required unless marked optional.

| Key | Value |
| --- | --- |
| `slug` | Lowercase kebab-case, e.g. `"zombie-outbreak"`. |
| `title`, `tagline`, `summary` | Strings. The summary is two or three sentences for the project card. |
| `tags` | An array of strings. |
| `status` | `"stub"`, `"in-progress"` or `"live"`. |
| `repo` | `"https://github.com/Mark-Bugden/<repo>"`. |
| `kitVersion` | The kit version the demo was built with, without the `v`, e.g. `"0.1.0"`. |
| `built` | The build date, `"YYYY-MM-DD"`. Update it when you cut a release. |
| `demo` | `{ "entry": "demo.js", "height": <stage height in px>, "needsWebGL": <boolean> }`. |
| `modelCard` | Optional, for projects built around a model. `{ "what": "…", "data": "…" (optional), "metric": "…" or null, "limits": ["…"] }`. |
| `writeup` | The write-up's site path, `"/projects/<slug>/"`. |
| `about` | Optional. Markdown for the frame's "How this works" panel. |

### Styles stay inside the demo

A bundle's CSS may only style its mount element and what is inside it. Every selector must reach its target through `[data-demo]`, so `:root`, `html`, `body` and bare class selectors are all out. This keeps a demo built against an older kit from restyling the site.

Demos import `tokens.scoped.css`, which declares the tokens on `[data-demo]`. The site keeps its own tokens on `:root`, in its stylesheet.

### Embedding

The site embeds a demo the same way `index.html` loads it:

```html
<link rel="stylesheet" href="/demos/<slug>/demo.css">
<div data-demo="<slug>" data-embedded>
  <img src="/demos/<slug>/static.webp" width="1200" height="675" alt="…">
</div>
<script type="module" src="/demos/<slug>/demo.js"></script>
```

The script replaces the contents of the `<div>`, so the still image covers loading and no-JavaScript. The site never iframes a demo.

When the bundle has `static-light.webp`, the site adds it as a second `<img>` beside the first, and its own stylesheet shows whichever matches the theme. `index.html` needs only `static.webp`, since a standalone demo is always dark.

`data-embedded` tells the frame that the page already shows the title, tagline, model card and links from the manifest, so the frame renders only the controls, stage, status line and "How this works". It also paints no background of its own, so the page shows through with no seam.

Demos are dark, as the site is, unless `<html>` has `data-theme="light"`, which the site's theme switch sets. The OS setting does not change the theme.

## API

Everything is exported from `@mark-bugden/demo-kit`. Each module is also available on its own path, e.g. `@mark-bugden/demo-kit/sim`. Import the two stylesheets once, in `src/main.js`:

```js
import { mount, slider } from '@mark-bugden/demo-kit';
import '@mark-bugden/demo-kit/tokens.scoped.css';
import '@mark-bugden/demo-kit/frame.css';
```

### `mount(options)`

The frame renders these, top to bottom:

1. Title and tagline
2. Controls rail: left of the stage on wide frames, stacked above it on narrow ones
3. Stage: the manifest's `height`, 16:9 on phones
4. Status line
5. A collapsible "How this works"
6. Model card, when the manifest has one
7. Links to the repo and the write-up

```js
const frame = mount({
  el: document.querySelector('[data-demo="zombie-outbreak"]'),
  manifest,                 // supplies title, tagline, about, modelCard, links and height
  controls: { rate: slider({ label: 'Infection rate', min: 0, max: 1, value: 0.3 }) },
  stage: 'canvas',          // or 'div' (the default), e.g. for charts or a three.js renderer
  animate: true,            // Play/Pause; starts paused under prefers-reduced-motion
  reset: () => { /* restore the initial state */ },
  render({ stage, width, height, pixelRatio, values, theme, time, delta, reason, token }) {
    // values.rate, the stage size in CSS pixels, the play clock in seconds, and why it ran
  },
});
frame.status('Day 12: 4,031 zombies');
```

- **`render` timing.** It runs once at the start, again after every control change, resize and theme change, and on every animation frame while playing. Animation stops while the stage is off screen.
- **`reason`** is one of `init`, `tick`, `controls`, `resize`, `theme`, `reset` or `redraw`.
- **Canvas sizing.** For a canvas stage, the frame sizes the backing store to the stage times `pixelRatio`. Call `ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)` and draw in CSS pixels.
- **Theme colours.** `token('--color-accent')` reads a token as a concrete colour. Re-read tokens when `reason === 'theme'`.
- **Overrides.** `title`, `tagline`, `about`, `modelCard`, `links` (`{ repo, writeup }`) and `height` override the manifest.
- **The handle.** `mount()` returns `{ stage, play(), pause(), playing, status(text), redraw(), destroy() }`.

### Controls

`slider()`, `toggle()`, `select()` and `preset()` each return `{ el, value, disabled, onChange }`.

- Setting `value` updates the control without notifying listeners.
- `onChange(fn)` fires on user input and returns an unsubscribe function.
- Pass `disabled: true` to show a planned control as a placeholder.

```js
slider({ label, min, max, step, value, format });
toggle({ label, value });
select({ label, options: ['ODE', 'Spatial'] });   // or [{ label, value }] with any values
preset({ label: 'Presets', options: [{ label: 'Fig. 4.2', value: { a: 0.5, b: 0.2 } }] });
```

### Numerical helpers

- **`rk4(f, y0, t0, dt, steps)`** is classical fourth-order Runge-Kutta for `y' = f(t, y)`. It returns `{ t, y }` with `steps + 1` entries each.
- **`gridDiffusion2D(u, width, height, rate, { mask, out })`** takes one explicit diffusion step on a row-major grid.
  - `rate = D·dt/dx²` and must be at most 0.25.
  - Edges and cells where `mask` is falsy are walls, so the total is conserved.
- **`runInWorker(fn, params, { onMessage, signal, transfer })`** runs `fn(params, post)` in a Web Worker and resolves with its return value.
  - `fn` is sent as source text, so it must be self-contained.
  - Calls to `post(value)` arrive at `onMessage`.
  - An aborted `signal` terminates the worker.

### Charts

`plot(spec, el)` renders an [Observable Plot](https://observablehq.com/plot/) spec into `el` and returns the chart. Build marks with the re-exported `Plot`:

```js
import { plot, Plot } from '@mark-bugden/demo-kit';
plot({ marks: [Plot.lineY(rows, { x: 'day', y: 'count', stroke: 'compartment' })] }, stage);
```

- **Width** fills `el`.
- **Text** uses the text face, and axes use the text colour.
- **Tooltips** sit on the surface colour.
- **Categorical colours** take `--chart-1` to `--chart-8` in order, and switch with the theme on their own.
- **Continuous colours** run from `--chart-seq-low` to `--chart-seq-high`.
- **Spec values win.** Anything set in `spec` overrides these defaults.

Call `plot()` inside `render`, so the chart follows resizes and theme changes.

Every chart slot clears 3:1 against the surface in both themes, so draw charts on the surface, as the stage does. On the light page background, slots 2, 3, 4, 5 and 8 fall to about 2.8:1. In dark mode, slots 2, 5 and 8 sit close to `--color-halpha`, so a chart that also draws with H-alpha should skip them.

### Loading data

```js
const episodes = await loadJSON('data/episodes.json');
const rows = await loadCSV('data/cases.csv');   // numbers parsed, empty fields null
```

Paths resolve against the demo's own folder. The same call works standalone, embedded under `/demos/<slug>/`, and under `npm run dev`. Pass `{ base }` to resolve against another URL.

### Theme

`getTheme()` returns `'dark'`, or `'light'` when `<html>` has `data-theme="light"`. `onThemeChange(fn)` calls `fn(theme)` whenever that switches, and returns an unsubscribe function. `token(el, name)` reads a token's computed value.

## Design tokens

[`tokens.css`](tokens.css) is the single source of design tokens. Its colours and faces follow the site's phase portrait design, in [`assets/css/site.css`](https://github.com/Mark-Bugden/Mark-Bugden.github.io/blob/main/assets/css/site.css), under the kit's names:

| Site | Kit | Dark (default) | Light |
| --- | --- | --- | --- |
| `--bg` | `--color-bg` | `#0a0e14` | `#f5f6f8` |
| `--panel` | `--color-surface` | `#111722` | `#ffffff` |
| `--fg` | `--color-text` | `#e8ecf2` | `#10151d` |
| `--muted` | `--color-muted` | `#9aa6b8` | `#556070` |
| `--line` | `--color-border` | `#2a3444` | `#d3d9e1` |
| `--curve` | `--color-curve` | `#526178` | `#98a4b5` |
| `--accent` | `--color-accent` | `#f6be55`, sodium amber | `#c2391b`, H-alpha red |

- **Theme:** dark, whatever the OS prefers; light only under `<html data-theme="light">`.
- **Colours:** text, muted text and the accent clear 4.5:1 on the background and surface in both themes, and `--color-on-accent` clears 4.5:1 on the accent. `--color-curve` is for secondary strokes, such as outlines and reference lines, and never for text. `--color-sodium` and `--color-halpha` name the two accents and stay the same in both themes, for demos that draw with them.
- **Charts:** eight categorical slots and a sequential ramp, checked for colour-vision deficiency on the surface. No slot sits within ΔE 15 of its theme's accent, so a series never looks like a link.
- **Type:** Space Grotesk for display, at weight 500 and −0.02em tracking as on the site's headings; Inter for text; JetBrains Mono for code. Each has a system fallback stack.
- **Spacing, radii and motion:** motion durations drop to zero under `prefers-reduced-motion`.

The kit names the fonts but does not ship them. The site self-hosts all three, so a standalone demo shows the fallback stacks.

`tokens.scoped.css` is generated. After editing `tokens.css`, run `npm run tokens` and commit both files; the tests fail if they differ.

## The validator

```sh
npx demo-kit validate <dir>                  # e.g. dist/, or static/demos/<slug>/ on the site
npx demo-kit validate <dir> --no-tag-check   # offline, or before the kit release exists
```

It checks the following:

- The file list, sizes and image dimensions.
- Every manifest key.
- That tag `v<kitVersion>` exists in this repo, using `git ls-remote`.
- That `index.html` loads the bundle by relative path with no inline scripts.
- That every `demo.css` rule is scoped to `[data-demo]`.

It exits 0 when the bundle passes, 1 when it fails, and 2 on a usage error. Project CI and site CI both run it, so they apply the same rules.

## Releases

Tags are `v<major>.<minor>.<patch>`, made on `main` only after the PR is merged. Version fields in JSON omit the `v`.

A change that breaks the bundle contract, such as a renamed manifest key or a changed mount API, is a major version. Mark it **Breaking** in [CHANGELOG.md](CHANGELOG.md).

To release:

1. In the PR, bump `version` in `package.json`, `kitVersion` in `template/public/manifest.json`, and the tag in `template/package.json`. Add a CHANGELOG entry. The tests check that all four agree.
2. After merge, tag the merge commit on `main` and push the tag.
3. CI then installs the template from that tag, builds it and validates it with the tag check on.

On branch pushes, CI builds the template against the packed working copy instead, and skips the tag check.

## Development

```sh
npm run lint     # ESLint
npm test         # node:test: validator, solvers, loader, Markdown subset, theme, tokens, template versions
npm run tokens   # regenerate tokens.scoped.css
```

## Licence

[MIT](LICENSE) © Mark Bugden
