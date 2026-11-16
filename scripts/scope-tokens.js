// Generates tokens.scoped.css from tokens.css: the same tokens, declared on [data-demo]
// instead of :root, so a demo bundle never styles the page around it.
//
//   node scripts/scope-tokens.js           write tokens.scoped.css
//   node scripts/scope-tokens.js --check   exit 1 if tokens.scoped.css is out of date

import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../tokens.css', import.meta.url);
const target = new URL('../tokens.scoped.css', import.meta.url);

const HEADER = `/*
 * Generated from tokens.css by scripts/scope-tokens.js (npm run tokens). Do not edit.
 *
 * The demo-kit tokens declared on [data-demo] for demo bundles. The site declares the
 * same tokens on :root from tokens.css; the theme still follows <html data-theme>.
 */`;

// ":root" becomes "[data-demo]"; ":root<conditions>" keeps its conditions on the root
// element and moves the declarations onto the demo inside it.
function scopeSelector(selector) {
  const match = /^:root((?:\[[^\]]*\]|:not\([^)]*\))*)$/.exec(selector.trim());
  if (!match) throw new Error(`tokens.css: every rule must start with :root, found "${selector.trim()}"`);
  return match[1] ? `:root${match[1]} [data-demo]` : '[data-demo]';
}

export function scopeTokens(css) {
  const body = css.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  // Rewrite style-rule selectors (text before "{" that is not an at-rule); leave comments alone.
  const scoped = body
    .split(/(\/\*[\s\S]*?\*\/)/)
    .map((part) => part.startsWith('/*') ? part : part.replace(/(^|[;{}])(\s*)([^\s;{}@][^;{}]*?)(\s*)\{/g,
      (all, lead, space, selector, gap) => `${lead}${space}${selector.split(',').map(scopeSelector).join(', ')}${gap}{`))
    .join('');
  return `${HEADER}\n\n${scoped}`;
}

const output = scopeTokens(readFileSync(source, 'utf8'));

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) {
    console.error('tokens.scoped.css is out of date: run `npm run tokens` and commit the result.');
    process.exit(1);
  }
  console.log('tokens.scoped.css is up to date.');
} else {
  writeFileSync(target, output);
  console.log('Wrote tokens.scoped.css');
}
