import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFICIENCIES, contrast, distance, parseHex, ramp, simulate, toOklab } from '../src/colour.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

// Custom properties declared in the first rule whose selector matches exactly.
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no rule for ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

// Every colour token in each theme: dark on :root, and light as dark with its own rule on top.
function themes() {
  const css = read('tokens.css');
  const dark = block(css, ':root');
  return { dark, light: { ...dark, ...block(css, ':root[data-theme="light"]') } };
}

const lightness = (color) => toOklab(parseHex(color))[0];
const seen = (color, vision) => (vision === 'normal' ? color : simulate(color, vision));
const VISIONS = ['normal', ...DEFICIENCIES];

// The spectrum's stops, and n steps evenly along it. 31 steps land on every stop (0, 1/3, 2/3 and 1)
// and between them.
const spectrum = (t) => [1, 2, 3, 4].map((i) => t[`--chart-spectrum-${i}`]);
const steps = (stops, n) => Array.from({ length: n }, (_, i) => ramp(stops)(i / (n - 1)));

describe('tokens', () => {
  it('tokens.scoped.css is generated from tokens.css', () => {
    const script = fileURLToPath(new URL('../scripts/scope-tokens.js', import.meta.url));
    const result = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  });

  it('tokens.scoped.css declares nothing on :root itself', () => {
    const selectors = [...read('tokens.scoped.css').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{/g)]
      .map(([, s]) => s.trim()).filter((s) => !s.startsWith('@'));
    assert.ok(selectors.length > 0);
    for (const selector of selectors) assert.match(selector, /\[data-demo\]$/);
  });

  it('text colours, the accent among them, clear 4.5:1 on the background and surface in both themes', () => {
    for (const [name, t] of Object.entries(themes())) {
      for (const fg of ['--color-text', '--color-muted', '--color-accent']) {
        for (const bg of ['--color-bg', '--color-surface']) {
          const ratio = contrast(t[fg], t[bg]);
          assert.ok(ratio >= 4.5, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
        }
      }
      assert.ok(contrast(t['--color-on-accent'], t['--color-accent']) >= 4.5, `${name}: --color-on-accent on --color-accent`);
    }
  });

  it('the contrasting highlight clears 3:1 on the surface in both themes', () => {
    for (const [name, t] of Object.entries(themes())) {
      const ratio = contrast(t['--color-accent-2'], t['--color-surface']);
      assert.ok(ratio >= 3, `${name}: --color-accent-2 on --color-surface is ${ratio.toFixed(2)}:1`);
    }
  });

  it('the two highlights stay apart, with and without colour-vision deficiencies', () => {
    // OKLab distance. Measured minimums: dark 0.284 (deuteranopia), light 0.205 (tritanopia).
    for (const [name, t] of Object.entries(themes())) {
      for (const vision of VISIONS) {
        const d = distance(seen(t['--color-accent'], vision), seen(t['--color-accent-2'], vision));
        assert.ok(d >= 0.2, `${name}, ${vision}: ${d.toFixed(3)}`);
      }
    }
  });

  it('chart slots clear 3:1 on the surface in both themes', () => {
    for (const [name, t] of Object.entries(themes())) {
      for (let slot = 1; slot <= 8; slot++) {
        const ratio = contrast(t[`--chart-${slot}`], t['--color-surface']);
        assert.ok(ratio >= 3, `${name}: --chart-${slot} on --color-surface is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it('no chart slot sits within delta E 15 of the accent, so a series never reads as a link', () => {
    for (const [name, t] of Object.entries(themes())) {
      for (let slot = 1; slot <= 8; slot++) {
        const dE = 100 * distance(t[`--chart-${slot}`], t['--color-accent']);
        assert.ok(dE >= 15, `${name}: --chart-${slot} is delta E ${dE.toFixed(1)} from --color-accent`);
      }
    }
  });

  it('every step of the spectrum clears 3:1 on the surface in both themes', () => {
    for (const [name, t] of Object.entries(themes())) {
      for (const color of steps(spectrum(t), 31)) {
        const ratio = contrast(color, t['--color-surface']);
        assert.ok(ratio >= 3, `${name}: ${color} on --color-surface is ${ratio.toFixed(2)}:1`);
      }
    }
  });

  it('the spectrum grows lighter from low to high, with and without colour-vision deficiencies', () => {
    for (const [name, t] of Object.entries(themes())) {
      const all = steps(spectrum(t), 31);
      for (const vision of VISIONS) {
        const l = all.map((color) => lightness(seen(color, vision)));
        assert.ok(l.slice(1).every((value, i) => value > l[i]), `${name}, ${vision}: ${l.map((v) => v.toFixed(3))}`);
      }
    }
  });

  it('six steps of the spectrum stay apart, with and without colour-vision deficiencies', () => {
    // OKLab distance; about 0.02 is a just-noticeable difference. Measured minimums: dark 0.075,
    // light 0.051, both under tritanopia.
    for (const [name, t] of Object.entries(themes())) {
      const six = steps(spectrum(t), 6);
      for (const vision of VISIONS) {
        for (let i = 1; i < six.length; i++) {
          const d = distance(seen(six[i - 1], vision), seen(six[i], vision));
          assert.ok(d >= 0.05, `${name}, ${vision}, step ${i}: ${d.toFixed(3)}`);
        }
      }
    }
  });

  it('is dark unless data-theme="light", which restates every colour but the fixed ones', () => {
    const css = read('tokens.css');
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /prefers-color-scheme/);
    const dark = block(css, ':root');
    const fixed = ['--color-focus', '--color-sodium', '--color-halpha'];
    const themed = Object.keys(dark).filter((name) => /^--(color|chart)-/.test(name) && !fixed.includes(name));
    assert.deepEqual(Object.keys(block(css, ':root[data-theme="light"]')).sort(), themed.sort());
  });
});

describe('template', () => {
  it('pins the kit version this commit will be tagged as', () => {
    const manifest = JSON.parse(read('template/public/manifest.json'));
    const template = JSON.parse(read('template/package.json'));
    assert.equal(manifest.kitVersion, pkg.version);
    assert.equal(template.dependencies['@mark-bugden/demo-kit'], `github:Mark-Bugden/demo-kit#v${pkg.version}`);
  });

  it('has a changelog entry for this version', () => {
    assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')}\\b`, 'm'));
  });
});
