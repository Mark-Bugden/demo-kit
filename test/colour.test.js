import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFICIENCIES, contrast, distance, fromOklab, interpolate, parseHex, ramp, simulate, toHex, toOklab } from '../src/colour.js';

describe('colour', () => {
  it('parses and formats hex colours', () => {
    assert.deepEqual(parseHex('#f6be55'), [246, 190, 85]);
    assert.deepEqual(parseHex(' #FFF '), [255, 255, 255]);
    assert.equal(toHex([246, 190, 85]), '#f6be55');
    assert.throws(() => parseHex('rgb(0, 0, 0)'), /hex/);
  });

  it('converts to OKLab and back', () => {
    assert.deepEqual(toOklab([255, 255, 255]).map((v) => +v.toFixed(4)), [1, 0, 0]);
    for (const color of ['#f6be55', '#285388', '#0a0e14']) assert.equal(toHex(fromOklab(toOklab(parseHex(color)))), color);
  });

  it('interpolates from one end to the other', () => {
    const scale = interpolate('#000000', '#ffffff');
    assert.equal(scale(0), '#000000');
    assert.equal(scale(1), '#ffffff');
    assert.equal(scale(-1), '#000000');
    assert.equal(scale(2), '#ffffff');
  });

  it('ramps through each stop in turn', () => {
    const scale = ramp(['#000000', '#ff0000', '#ffffff']);
    assert.equal(scale(0), '#000000');
    assert.equal(scale(0.5), '#ff0000');
    assert.equal(scale(1), '#ffffff');
    assert.equal(scale(0.25), interpolate('#000000', '#ff0000')(0.5));
    assert.equal(scale(-1), '#000000');
    assert.equal(scale(2), '#ffffff');
    assert.throws(() => ramp(['#000000']), /two or more/);
  });

  it('computes WCAG contrast', () => {
    assert.equal(contrast('#000000', '#ffffff').toFixed(2), '21.00');
    assert.equal(contrast('#c2391b', '#ffffff').toFixed(2), '5.39');
  });

  it('simulates colour-vision deficiencies', () => {
    assert.deepEqual(DEFICIENCIES, ['protanopia', 'deuteranopia', 'tritanopia']);
    for (const vision of DEFICIENCIES) {
      // Greys look the same to everyone.
      assert.equal(simulate('#808080', vision), '#808080');
    }
    // Red and green, far apart with normal vision, all but merge without red or green cones.
    assert.ok(distance('#d62728', '#2ca02c') > 0.3);
    assert.ok(distance(simulate('#d62728', 'deuteranopia'), simulate('#2ca02c', 'deuteranopia')) < 0.1);
  });
});
