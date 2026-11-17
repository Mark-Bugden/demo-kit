import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/validate.js', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'demo-kit-validate-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

// Minimal image headers: the validator reads dimensions only.
function webp(width, height) {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF', 0, 'ascii');
  bytes.writeUInt32LE(22, 4);
  bytes.write('WEBPVP8X', 8, 'ascii');
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
}

function jpeg(width, height) {
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Buffer.from([0xff, 0xd8, ...sof, 0xff, 0xd9]);
}

const MANIFEST = {
  slug: 'example',
  title: 'Exemplifying the Example',
  tagline: 'A bundle that follows the contract.',
  summary: 'Used by the validator tests.',
  tags: ['test'],
  status: 'stub',
  repo: 'https://github.com/Mark-Bugden/example',
  kitVersion: '0.1.0',
  built: '2026-11-17',
  demo: { entry: 'demo.js', height: 560, needsWebGL: false },
  modelCard: { what: 'Nothing.', metric: null, limits: ['None yet.'] },
  writeup: '/projects/example/',
};

const INDEX = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Example</title>
<script type="module" crossorigin src="./demo.js"></script>
<link rel="stylesheet" crossorigin href="./demo.css"></head>
<body><div data-demo="example"><img src="./static.webp" alt="" width="1200" height="675"></div></body></html>`;

const CSS = `[data-demo]{color:red}[data-demo] .a,[data-demo]>p{margin:0}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) [data-demo]{color:blue}}
:root[data-theme=dark] [data-demo]{color:blue}@container (min-width:48rem){[data-demo] .b{gap:1px}}
[data-demo] input:nth-child(2n+1)~label{color:green}@keyframes dk-spin{from{opacity:0}to{opacity:1}}`;

let count = 0;
function bundle({ manifest = MANIFEST, index = INDEX, css = CSS, files = {} } = {}) {
  const dir = join(scratch, `bundle-${++count}`);
  mkdirSync(dir);
  const contents = {
    'manifest.json': JSON.stringify(manifest),
    'index.html': index,
    'demo.js': 'export {};',
    'demo.css': css,
    'thumb.webp': webp(1200, 675),
    'og.jpg': jpeg(1200, 630),
    'static.webp': webp(1200, 675),
    ...files,
  };
  for (const [path, content] of Object.entries(contents)) {
    if (content === null) continue;
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

function run(...args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { code: result.status, output: result.stdout + result.stderr };
}

const validate = (dir) => run('validate', dir, '--no-tag-check');
const withManifest = (changes) => bundle({ manifest: { ...MANIFEST, ...changes } });
const without = (key) => bundle({ manifest: Object.fromEntries(Object.entries(MANIFEST).filter(([k]) => k !== key)) });

describe('demo-kit validate', () => {
  it('passes a bundle that follows the contract', () => {
    const { code, output } = validate(bundle({ files: { 'data/episodes.json': '[]', 'model/predict.js': 'export {};' } }));
    assert.equal(code, 0, output);
    assert.match(output, /bundle valid/);
  });

  it('fails when a required key is missing', () => {
    const { code, output } = validate(without('tagline'));
    assert.equal(code, 1);
    assert.match(output, /missing required key "tagline"/);
  });

  it('passes a manifest without a model card', () => {
    const { code, output } = validate(without('modelCard'));
    assert.equal(code, 0, output);
    assert.match(output, /bundle valid/);
  });

  it('fails on invalid values', () => {
    assert.match(validate(withManifest({ status: 'draft' })).output, /"status" must be one of/);
    assert.match(validate(withManifest({ kitVersion: 'v0.1.0' })).output, /"kitVersion" must be a version like "0.1.0" \(no leading "v"\)/);
    assert.match(validate(withManifest({ demo: { entry: 'main.js', height: 560, needsWebGL: false } })).output, /"demo.entry" must be "demo.js"/);
    assert.match(validate(withManifest({ modelCard: { what: 'x', limits: [] } })).output, /missing required key "modelCard.metric"/);
    assert.match(validate(withManifest({ modelCard: null })).output, /"modelCard", when present, must be an object/);
  });

  it('warns about a write-up path that does not match the slug', () => {
    const { code, output } = validate(withManifest({ writeup: '/projects/other/' }));
    assert.equal(code, 0, output);
    assert.match(output, /WARN .*site write-ups live at "\/projects\/example\/"/);
  });

  it('fails on missing and unexpected files', () => {
    assert.match(validate(bundle({ files: { 'og.jpg': null } })).output, /missing required files: og.jpg/);
    assert.match(validate(bundle({ files: { 'assets/chunk.js': '' } })).output, /unexpected files .*assets\/chunk.js/);
    assert.match(validate(bundle({ files: { 'data/raw.parquet': '' } })).output, /unexpected files .*data\/raw.parquet/);
    assert.match(validate(bundle({ files: { '.DS_Store': '' } })).output, /unexpected files .*\.DS_Store/);
  });

  it('fails on images of the wrong size', () => {
    assert.match(validate(bundle({ files: { 'thumb.webp': webp(1200, 630) } })).output, /thumb.webp: must be 1200×675 px, is 1200×630/);
    assert.match(validate(bundle({ files: { 'og.jpg': webp(1200, 630) } })).output, /og.jpg: not a readable JPEG file/);
    assert.match(validate(bundle({ files: { 'thumb.webp': Buffer.concat([webp(1200, 675), Buffer.alloc(80_000)]) } })).output, /must be under 80.0 KB/);
  });

  it('fails on CSS that styles the page outside the demo', () => {
    for (const css of [':root{--x:1}', 'body{margin:0}', '.card{color:red}', '[data-demo] ~ p{color:red}', ':not([data-demo]) p{color:red}', '@media print{html{color:red}}']) {
      const { code, output } = validate(bundle({ css }));
      assert.equal(code, 1, `${css}\n${output}`);
      assert.match(output, /unscoped selectors/);
    }
  });

  it('fails on inline scripts and absolute asset paths', () => {
    const inline = INDEX.replace('</body>', '<script>alert(1)</script></body>');
    assert.match(validate(bundle({ index: inline })).output, /inline <script>/);
    const absolute = INDEX.replace('src="./demo.js"', 'src="/demo.js"');
    assert.match(validate(bundle({ index: absolute })).output, /script src "\/demo.js" must be a relative path/);
    const handler = INDEX.replace('<body>', '<body onload="go()">');
    assert.match(validate(bundle({ index: handler })).output, /inline event handler/);
  });

  it('reports usage errors with exit code 2', () => {
    assert.equal(run('check', scratch).code, 2);
    assert.equal(run('validate').code, 2);
    assert.equal(run('validate', join(scratch, 'missing')).code, 2);
  });

  it('prints its version', () => {
    assert.match(run('--version').output, /^\d+\.\d+\.\d+/);
  });
});
