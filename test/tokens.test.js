import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

// Custom properties declared in the first rule whose selector matches exactly.
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `no rule for ${selector}`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

  it('text colours clear 4.5:1 on the background and surface in both themes', () => {
    const css = read('tokens.css');
    const dark = block(css, ':root');
    const themes = { dark, light: { ...dark, ...block(css, ':root[data-theme="light"]') } };
    for (const [name, t] of Object.entries(themes)) {
      for (const fg of ['--color-text', '--color-muted', '--color-accent']) {
        for (const bg of ['--color-bg', '--color-surface']) {
          const ratio = contrast(t[fg], t[bg]);
          assert.ok(ratio >= 4.5, `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
        }
      }
      assert.ok(contrast(t['--color-on-accent'], t['--color-accent']) >= 4.5, `${name}: --color-on-accent on --color-accent`);
    }
  });

  it('chart slots clear 3:1 on the surface in both themes', () => {
    const css = read('tokens.css');
    const dark = block(css, ':root');
    const themes = { dark, light: { ...dark, ...block(css, ':root[data-theme="light"]') } };
    for (const [name, t] of Object.entries(themes)) {
      for (let slot = 1; slot <= 8; slot++) {
        const ratio = contrast(t[`--chart-${slot}`], t['--color-surface']);
        assert.ok(ratio >= 3, `${name}: --chart-${slot} on --color-surface is ${ratio.toFixed(2)}:1`);
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
