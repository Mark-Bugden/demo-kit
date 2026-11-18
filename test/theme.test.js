import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { getTheme, onThemeChange } from '../src/theme.js';

// Stand-ins for <html>, MutationObserver and an OS that prefers light: theme.js only reads
// data-theme and watches it.
let attribute;
let observers;

beforeEach(() => {
  attribute = null;
  observers = [];
  globalThis.document = { documentElement: { getAttribute: (name) => (name === 'data-theme' ? attribute : null) } };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.push(this); }
    disconnect() { observers = observers.filter((observer) => observer !== this); }
  };
});

afterEach(() => {
  delete globalThis.document;
  delete globalThis.matchMedia;
  delete globalThis.MutationObserver;
});

function setTheme(value) {
  attribute = value;
  for (const observer of observers) observer.callback([]);
}

describe('theme', () => {
  it('is dark unless <html data-theme="light">, whatever the OS prefers', () => {
    for (const [value, theme] of [[null, 'dark'], ['dark', 'dark'], ['', 'dark'], ['auto', 'dark'], ['light', 'light']]) {
      attribute = value;
      assert.equal(getTheme(), theme, `data-theme=${JSON.stringify(value)}`);
    }
  });

  it('reports switches between light and dark until unsubscribed', () => {
    const seen = [];
    const off = onThemeChange((theme) => seen.push(theme));
    setTheme('dark');
    setTheme('light');
    setTheme(null);
    off();
    setTheme('light');
    assert.deepEqual(seen, ['light', 'dark']);
  });
});
