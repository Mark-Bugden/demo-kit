import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markdown } from '../src/markdown.js';

describe('markdown subset', () => {
  it('renders paragraphs, emphasis, code and links', () => {
    assert.equal(
      markdown('A **bold** and *quiet* claim with `code_x_y`.\nSame paragraph, [link](https://example.com/a_b_c).\n\nSecond.'),
      '<p>A <strong>bold</strong> and <em>quiet</em> claim with <code>code_x_y</code>. Same paragraph, <a href="https://example.com/a_b_c" rel="noopener">link</a>.</p>\n<p>Second.</p>',
    );
  });

  it('renders lists and demotes headings to bold paragraphs', () => {
    assert.equal(markdown('## Steps\n\n- one\n- _two_\n\n1. first\n2. second'),
      '<p><strong>Steps</strong></p>\n<ul><li>one</li><li><em>two</em></li></ul>\n<ol><li>first</li><li>second</li></ol>');
  });

  it('keeps balanced parentheses in link URLs', () => {
    assert.equal(markdown('[curve](https://en.wikipedia.org/wiki/Lissajous_(curve))'),
      '<p><a href="https://en.wikipedia.org/wiki/Lissajous_(curve)" rel="noopener">curve</a></p>');
  });

  it('escapes HTML and drops unsafe links', () => {
    assert.equal(markdown('<img src=x onerror=alert(1)> [x](javascript:alert(1))'),
      '<p>&lt;img src=x onerror=alert(1)&gt; x</p>');
  });
});
