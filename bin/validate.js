#!/usr/bin/env node
// demo-kit validate <dir> [--no-tag-check]
//
// Checks a built demo bundle (a demo's dist/, or the site's static/demos/<slug>/) against the
// bundle contract. Project CI and site CI both run it, so they apply the same rules.
// Exits 0 when the bundle passes, 1 when it does not, 2 on a usage error.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const KIT_REPO = 'https://github.com/Mark-Bugden/demo-kit.git';
const KB = 1000;
const REQUIRED_FILES = ['manifest.json', 'index.html', 'demo.js', 'demo.css', 'thumb.webp', 'og.jpg', 'static.webp'];
const OPTIONAL_DIRS = ['data', 'model'];
const DATA_EXTENSIONS = ['.json', '.csv', '.js'];
const MAX_BUNDLE_BYTES = 2000 * KB;
const STATUSES = ['stub', 'in-progress', 'live'];
const MANIFEST_KEYS = ['slug', 'title', 'tagline', 'summary', 'tags', 'status', 'repo', 'kitVersion', 'built', 'demo', 'modelCard', 'writeup', 'about'];

const USAGE = `Usage: demo-kit validate <dir> [--no-tag-check]

Checks a built demo bundle against the demo-kit bundle contract.

  --no-tag-check   skip checking that tag v<kitVersion> exists in Mark-Bugden/demo-kit
                   (for offline work, and the kit's own CI before a release is tagged)`;

const kitVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// Reporting

const problems = [];
const warnings = [];
const pass = (message) => console.log(`  PASS  ${message}`);
const fail = (message) => { problems.push(message); console.log(`  FAIL  ${message}`); };
const warn = (message) => { warnings.push(message); console.log(`  WARN  ${message}`); };
const kb = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

// Files

function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(join(dir, entry.name), path) : [path];
  });
}

function checkFiles(dir) {
  const files = listFiles(dir);
  const missing = REQUIRED_FILES.filter((name) => !files.includes(name));
  if (missing.length) fail(`missing required files: ${missing.join(', ')}`);
  else pass(`required files present: ${REQUIRED_FILES.join(', ')}`);

  const extra = files.filter((path) => {
    if (REQUIRED_FILES.includes(path)) return false;
    const [top, ...rest] = path.split('/');
    return !(OPTIONAL_DIRS.includes(top) && rest.length && DATA_EXTENSIONS.includes(extname(path).toLowerCase()));
  });
  if (extra.length) {
    fail(`unexpected files (only ${REQUIRED_FILES.join(', ')} and ${DATA_EXTENSIONS.join('/')} files under data/ or model/ are allowed): ${extra.join(', ')}`);
  }

  const total = files.reduce((sum, path) => sum + statSync(join(dir, path)).size, 0);
  if (total > MAX_BUNDLE_BYTES) fail(`bundle is ${kb(total)}; the limit is ${kb(MAX_BUNDLE_BYTES)}`);
  else pass(`bundle size ${kb(total)} (limit ${kb(MAX_BUNDLE_BYTES)})`);
  return files;
}

// Manifest

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function checkManifest(dir) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (error) {
    fail(`manifest.json is not valid JSON: ${error.message}`);
    return null;
  }
  if (!isObject(manifest)) {
    fail('manifest.json must contain a JSON object');
    return null;
  }

  const before = problems.length;
  const m = manifest;
  const need = (key, ok, expected) => {
    if (!(key in m)) fail(`manifest.json: missing required key "${key}"`);
    else if (!ok(m[key])) fail(`manifest.json: "${key}" must be ${expected}, got ${JSON.stringify(m[key])}`);
  };

  need('slug', (v) => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), 'a lowercase kebab-case string');
  need('title', isText, 'a non-empty string');
  need('tagline', isText, 'a non-empty string');
  need('summary', isText, 'a non-empty string');
  need('tags', (v) => Array.isArray(v) && v.every(isText), 'an array of non-empty strings');
  need('status', (v) => STATUSES.includes(v), `one of ${STATUSES.map((s) => `"${s}"`).join(', ')}`);
  need('repo', (v) => typeof v === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(v), 'a https://github.com/<owner>/<repo> URL');
  need('kitVersion', (v) => typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v), 'a version like "0.1.0" (no leading "v")');
  need('built', (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), 'a date like "2026-11-16"');
  need('writeup', (v) => typeof v === 'string' && v.startsWith('/'), 'a site path starting with "/"');
  need('demo', isObject, 'an object');
  if (isObject(m.demo)) {
    if (m.demo.entry !== 'demo.js') fail(`manifest.json: "demo.entry" must be "demo.js", got ${JSON.stringify(m.demo.entry)}`);
    if (!(Number.isInteger(m.demo.height) && m.demo.height > 0)) fail(`manifest.json: "demo.height" must be a positive integer (px), got ${JSON.stringify(m.demo.height)}`);
    if (typeof m.demo.needsWebGL !== 'boolean') fail(`manifest.json: "demo.needsWebGL" must be true or false, got ${JSON.stringify(m.demo.needsWebGL)}`);
  }
  if ('modelCard' in m && !isObject(m.modelCard)) fail(`manifest.json: "modelCard", when present, must be an object, got ${JSON.stringify(m.modelCard)}`);
  if (isObject(m.modelCard)) {
    const card = m.modelCard;
    if (!isText(card.what)) fail('manifest.json: "modelCard.what" must be a non-empty string');
    if (card.data != null && !isText(card.data)) fail('manifest.json: "modelCard.data", when present, must be a non-empty string');
    if (!('metric' in card)) fail('manifest.json: missing required key "modelCard.metric" (use null when there is no metric)');
    else if (card.metric !== null && !isText(card.metric)) fail('manifest.json: "modelCard.metric" must be a non-empty string or null');
    if (!(Array.isArray(card.limits) && card.limits.every(isText))) fail('manifest.json: "modelCard.limits" must be an array of non-empty strings');
  }
  if ('about' in m && !isText(m.about)) fail('manifest.json: "about", when present, must be a non-empty string of Markdown');

  const unknown = Object.keys(m).filter((key) => !MANIFEST_KEYS.includes(key));
  if (unknown.length) warn(`manifest.json: unknown keys ignored: ${unknown.join(', ')}`);
  if (Array.isArray(m.tags) && m.tags.length === 0) warn('manifest.json: "tags" is empty');
  if (Array.isArray(m.modelCard?.limits) && m.modelCard.limits.length === 0) warn('manifest.json: "modelCard.limits" is empty');
  if (isText(m.slug) && typeof m.writeup === 'string' && m.writeup !== `/projects/${m.slug}/`) {
    warn(`manifest.json: "writeup" is ${JSON.stringify(m.writeup)}; site write-ups live at "/projects/${m.slug}/"`);
  }

  if (problems.length === before) pass(`manifest.json: all required keys valid (slug "${m.slug}", status "${m.status}")`);
  return manifest;
}

function checkKitTag(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return;
  const tag = `v${version}`;
  let output;
  try {
    output = execFileSync('git', ['ls-remote', '--tags', KIT_REPO, `refs/tags/${tag}`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    });
  } catch (error) {
    fail(`kitVersion ${version}: could not ask ${KIT_REPO} whether tag ${tag} exists (${error.message.split('\n')[0]}); use --no-tag-check when offline`);
    return;
  }
  if (output.trim()) pass(`kitVersion ${version}: tag ${tag} exists in Mark-Bugden/demo-kit`);
  else fail(`kitVersion ${version}: tag ${tag} does not exist in Mark-Bugden/demo-kit`);
}

// index.html

const attribute = (tag, name) => new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined);
const isRelative = (url) => !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(url);
const isBundleFile = (url, name) => url.replace(/^\.\//, '').split(/[?#]/)[0] === name;

function checkIndexHtml(dir, slug) {
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  const before = problems.length;

  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  for (const [, attributes] of scripts) {
    const src = attribute(attributes, 'src');
    if (src === undefined) {
      fail('index.html: inline <script> found; scripts must load from files');
    } else if (!isRelative(src)) {
      fail(`index.html: script src "${src}" must be a relative path (no leading "/", no external URLs)`);
    }
  }
  if (!scripts.some(([, attributes]) => isBundleFile(attribute(attributes, 'src') ?? '', 'demo.js') && /type\s*=\s*["']?module/i.test(attributes))) {
    fail('index.html: must load demo.js with <script type="module" src="./demo.js">');
  }

  const tags = html.match(/<[a-z][^>]*>/gi) ?? [];
  if (tags.some((tag) => /\son[a-z]+\s*=/i.test(tag))) fail('index.html: inline event handler attributes (onclick=…) are not allowed');

  const stylesheets = tags.filter((tag) => /^<link\b/i.test(tag) && /rel\s*=\s*["']?stylesheet/i.test(tag));
  for (const tag of stylesheets) {
    const href = attribute(tag, 'href') ?? '';
    if (!isRelative(href)) fail(`index.html: stylesheet href "${href}" must be a relative path (no leading "/", no external URLs)`);
  }
  if (!stylesheets.some((tag) => isBundleFile(attribute(tag, 'href') ?? '', 'demo.css'))) {
    fail('index.html: must load demo.css with <link rel="stylesheet" href="./demo.css">');
  }

  for (const tag of tags.filter((t) => /^<(img|source)\b/i.test(t))) {
    const src = attribute(tag, 'src') ?? attribute(tag, 'srcset') ?? '';
    if (src && !isRelative(src)) fail(`index.html: image "${src}" must be a relative path`);
  }

  if (/^[a-z0-9-]+$/.test(slug ?? '') && !new RegExp(`data-demo\\s*=\\s*["']?${slug}["'\\s>]`).test(html)) {
    fail(`index.html: no mount element <div data-demo="${slug}">`);
  }

  if (problems.length === before) pass('index.html: loads ./demo.js and ./demo.css by relative path, no inline scripts');
}

// demo.css: every rule must reach its subject through [data-demo].

function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function stripGroups(selector, pattern) {
  let previous;
  let result = selector;
  do {
    previous = result;
    result = result.replace(pattern, '');
  } while (result !== previous);
  return result;
}

function isScoped(selector) {
  // :not(...) can only exclude elements, so a [data-demo] inside it scopes nothing.
  const positive = stripGroups(selector, /:not\((?:[^()]|\([^()]*\))*\)/gi);
  const at = positive.search(/\[\s*data-demo\s*(?:[~|^$*]?=[^\]]*)?\]/i);
  if (at < 0) return false;
  // A sibling combinator straight after the [data-demo] compound reaches outside it;
  // anything after a descendant or child combinator stays inside.
  const after = stripGroups(positive.slice(at), /\[[^\]]*\]|\([^()]*\)/g);
  return !/^[^\s>+~]*\s*[+~]/.test(after);
}

function checkCss(dir, slug) {
  const css = readFileSync(join(dir, 'demo.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const unscoped = [];
  const stack = [];
  let prelude = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const end = css.indexOf(c, i + 1);
      prelude += css.slice(i, end < 0 ? css.length : end + 1);
      i = end < 0 ? css.length : end;
    } else if (c === '{') {
      const text = prelude.trim();
      const parent = stack[stack.length - 1];
      prelude = '';
      if (parent === 'skip') {
        stack.push('skip');
      } else if (text.startsWith('@')) {
        const name = /^@([\w-]+)/.exec(text)?.[1].toLowerCase();
        if (['media', 'supports', 'container', 'layer', 'scope', 'starting-style'].includes(name)) {
          stack.push(parent === 'rule' ? 'rule' : 'group');
        } else {
          if (name === 'keyframes' || name === '-webkit-keyframes') {
            const animation = text.split(/\s+/)[1] ?? '';
            if (!animation.startsWith('dk-') && !(slug && animation.startsWith(`${slug}-`))) {
              warn(`demo.css: @keyframes ${animation} is a page-wide name; prefix it with "${slug ?? '<slug>'}-"`);
            }
          } else if (name === 'font-face' || name === 'property') {
            warn(`demo.css: @${name} applies to the whole page; fonts and registered properties belong to the site`);
          }
          stack.push('skip');
        }
      } else if (parent === 'rule') {
        stack.push('rule'); // nested inside a scoped rule
      } else {
        unscoped.push(...splitSelectors(text).filter((selector) => !isScoped(selector)));
        stack.push('rule');
      }
    } else if (c === '}') {
      stack.pop();
      prelude = '';
    } else if (c === ';') {
      if (!stack.length && /^@import\b/i.test(prelude.trim())) fail(`demo.css: ${prelude.trim()} is not allowed; bundle all CSS into demo.css`);
      prelude = '';
    } else {
      prelude += c;
    }
  }
  if (unscoped.length) {
    const shown = [...new Set(unscoped)].slice(0, 8);
    fail(`demo.css: rules must only style [data-demo] and its contents; unscoped selectors: ${shown.join(' | ')}${unscoped.length > shown.length ? ' …' : ''}`);
  } else {
    pass('demo.css: every rule is scoped to [data-demo]');
  }
}

// Images

function webpSize(bytes) {
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  return null;
}

function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) { i++; continue; }
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the frame size.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  return null;
}

function checkImage(dir, name, { format, width, height, maxBytes }) {
  const bytes = readFileSync(join(dir, name));
  const size = format === 'WebP' ? webpSize(bytes) : jpegSize(bytes);
  if (!size) {
    fail(`${name}: not a readable ${format} file`);
    return;
  }
  const errors = [];
  if (width && (size.width !== width || size.height !== height)) errors.push(`must be ${width}×${height} px, is ${size.width}×${size.height}`);
  if (maxBytes && bytes.length >= maxBytes) errors.push(`must be under ${kb(maxBytes)}, is ${kb(bytes.length)}`);
  if (errors.length) fail(`${name}: ${errors.join('; ')}`);
  else pass(`${name}: ${format} ${size.width}×${size.height}, ${kb(bytes.length)}`);
}

// Main

function validate(dir, { tagCheck = true } = {}) {
  console.log(`demo-kit ${kitVersion} validate ${dir}`);
  const files = checkFiles(dir);
  const has = (name) => files.includes(name);
  const manifest = has('manifest.json') ? checkManifest(dir) : null;
  if (manifest) {
    if (tagCheck) checkKitTag(manifest.kitVersion);
    else warn(`kitVersion ${manifest.kitVersion}: tag check skipped (--no-tag-check)`);
  }
  if (has('index.html')) checkIndexHtml(dir, manifest?.slug);
  if (has('demo.css')) checkCss(dir, manifest?.slug);
  if (has('demo.js') && statSync(join(dir, 'demo.js')).size === 0) fail('demo.js is empty');
  if (has('thumb.webp')) checkImage(dir, 'thumb.webp', { format: 'WebP', width: 1200, height: 675, maxBytes: 80 * KB });
  if (has('og.jpg')) checkImage(dir, 'og.jpg', { format: 'JPEG', width: 1200, height: 630, maxBytes: 150 * KB });
  if (has('static.webp')) checkImage(dir, 'static.webp', { format: 'WebP' });

  const summary = `${problems.length} problem${problems.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
  console.log(problems.length ? `FAIL  ${dir}: ${summary}` : `OK    ${dir}: bundle valid (${summary})`);
  return problems.length === 0;
}

function main(args) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(kitVersion);
    return 0;
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const [command, dir, ...rest] = args.filter((arg) => arg !== '--no-tag-check');
  if (command !== 'validate' || !dir || rest.length || args.some((arg) => arg.startsWith('-') && arg !== '--no-tag-check')) {
    console.error(USAGE);
    return 2;
  }
  const path = resolve(dir);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    console.error(`demo-kit validate: ${dir} is not a directory`);
    return 2;
  }
  return validate(dir, { tagCheck: !args.includes('--no-tag-check') }) ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
