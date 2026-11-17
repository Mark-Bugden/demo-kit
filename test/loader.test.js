import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCSV, loadJSON } from '../src/loader.js';

const dataUrl = (type, text) => `data:${type},${encodeURIComponent(text)}`;

describe('loader', () => {
  it('loads JSON', async () => {
    assert.deepEqual(await loadJSON(dataUrl('application/json', '{"a":[1,2]}')), { a: [1, 2] });
  });

  it('parses CSV with quotes, CRLF, a BOM and typed values', async () => {
    const csv = '﻿title,rating,note\r\n"Blink, a story",9.8,\r\n"Say ""hi""",-1e2,"two\nlines"\r\n\r\n';
    assert.deepEqual(await loadCSV(dataUrl('text/csv', csv)), [
      { title: 'Blink, a story', rating: 9.8, note: null },
      { title: 'Say "hi"', rating: -100, note: 'two\nlines' },
    ]);
  });

  it('keeps strings when typed is false', async () => {
    assert.deepEqual(await loadCSV(dataUrl('text/csv', 'x,y\n1,\n'), { typed: false }), [{ x: '1', y: '' }]);
  });

  it('resolves relative URLs against an explicit base', async () => {
    const base = dataUrl('application/json', '{"ok":true}');
    assert.deepEqual(await loadJSON(base, { base: 'https://example.invalid/demos/x/' }), { ok: true });
  });
});
