import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gridDiffusion2D, rk4, runInWorker } from '../src/sim.js';

describe('rk4', () => {
  it('integrates exponential decay to fourth-order accuracy', () => {
    const { t, y } = rk4((_, [u]) => [-u], [1], 0, 0.1, 50);
    assert.equal(t.length, 51);
    assert.ok(Math.abs(t[50] - 5) < 1e-12);
    assert.ok(Math.abs(y[50][0] - Math.exp(-5)) < 1e-7);
  });

  it('keeps a harmonic oscillator on its orbit', () => {
    const { y } = rk4((_, [x, v]) => [v, -x], [1, 0], 0, 0.01, Math.round((2 * Math.PI) / 0.01));
    const [x, v] = y[y.length - 1];
    assert.ok(Math.abs(x * x + v * v - 1) < 1e-8);
  });

  it('copies slopes, so f may reuse its output array', () => {
    const out = [0];
    const { y } = rk4((_, [u]) => { out[0] = -u; return out; }, [1], 0, 0.1, 10);
    assert.ok(Math.abs(y[10][0] - Math.exp(-1)) < 1e-6);
  });
});

describe('gridDiffusion2D', () => {
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  it('spreads a point source and conserves the total', () => {
    const u = new Float64Array(25);
    u[12] = 1;
    const out = gridDiffusion2D(u, 5, 5, 0.2);
    assert.ok(Math.abs(out[12] - 0.2) < 1e-12);
    assert.ok(Math.abs(out[7] - 0.2) < 1e-12);
    assert.ok(Math.abs(sum(out) - 1) < 1e-12);
  });

  it('treats masked cells as walls', () => {
    const u = new Float64Array([1, 0, 0]);
    const mask = new Uint8Array([1, 1, 0]);
    let a = u;
    for (let i = 0; i < 200; i++) a = gridDiffusion2D(a, 3, 1, 0.25, { mask });
    assert.ok(Math.abs(a[0] - 0.5) < 1e-6 && Math.abs(a[1] - 0.5) < 1e-6);
    assert.equal(a[2], 0);
  });

  it('rejects an unstable rate and mismatched sizes', () => {
    assert.throws(() => gridDiffusion2D(new Float64Array(4), 2, 2, 0.3), /between 0 and 0.25/);
    assert.throws(() => gridDiffusion2D(new Float64Array(5), 2, 2, 0.1), /expected 2×2/);
  });
});

describe('runInWorker', () => {
  it('resolves with the result and forwards progress (main-thread fallback in Node)', async () => {
    const progress = [];
    const result = await runInWorker((n, post) => {
      let total = 0;
      for (let i = 1; i <= n; i++) {
        total += i;
        if (i % 5 === 0) post(i);
      }
      return total;
    }, 10, { onMessage: (value) => progress.push(value) });
    assert.equal(result, 55);
    assert.deepEqual(progress, [5, 10]);
  });

  it('rejects when already aborted', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stopped'));
    await assert.rejects(runInWorker(() => 1, null, { signal: controller.signal }), /stopped/);
  });
});
