// Numerical helpers shared by the demos.

/**
 * Integrates y' = f(t, y) with classical fixed-step fourth-order Runge-Kutta.
 * `f(t, y)` returns the derivative as an array; `y0` is the initial state.
 * Returns { t, y }: t is a Float64Array of steps + 1 times, y an array of steps + 1
 * Float64Array states, both starting at (t0, y0).
 */
export function rk4(f, y0, t0, dt, steps) {
  const n = y0.length;
  const t = new Float64Array(steps + 1);
  const y = new Array(steps + 1);
  const probe = new Float64Array(n);
  let current = Float64Array.from(y0);
  t[0] = t0;
  y[0] = current;
  // Copy each slope, in case f reuses one output array between calls.
  const slope = (time, state) => Float64Array.from(f(time, state));
  const shifted = (k, scale) => {
    for (let j = 0; j < n; j++) probe[j] = current[j] + scale * k[j];
    return probe;
  };
  for (let s = 0; s < steps; s++) {
    const time = t0 + s * dt;
    const k1 = slope(time, current);
    const k2 = slope(time + dt / 2, shifted(k1, dt / 2));
    const k3 = slope(time + dt / 2, shifted(k2, dt / 2));
    const k4 = slope(time + dt, shifted(k3, dt));
    const next = new Float64Array(n);
    for (let j = 0; j < n; j++) next[j] = current[j] + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
    t[s + 1] = t0 + (s + 1) * dt;
    y[s + 1] = next;
    current = next;
  }
  return { t, y };
}

/**
 * One explicit diffusion step on a width × height grid stored row by row in `u`:
 * out[i] = u[i] + rate · Σ(u[neighbour] − u[i]) over the four neighbours, where
 * rate = D·dt/dx². The edges and any cell where `mask[i]` is falsy are walls (no flux),
 * so the total over the domain is conserved. Masked cells are copied through unchanged.
 * Stable for rate ≤ 0.25. Writes into `out` (a new array if omitted) and returns it.
 */
export function gridDiffusion2D(u, width, height, rate, { mask = null, out } = {}) {
  if (u.length !== width * height) throw new RangeError(`gridDiffusion2D: u has ${u.length} cells, expected ${width}×${height}`);
  if (!(rate >= 0 && rate <= 0.25)) throw new RangeError(`gridDiffusion2D: rate must be between 0 and 0.25 for a stable step, got ${rate}`);
  if (mask && mask.length !== u.length) throw new RangeError('gridDiffusion2D: mask must be the same size as u');
  const result = out ?? (ArrayBuffer.isView(u) ? new u.constructor(u.length) : new Float64Array(u.length));
  if (result === u) throw new Error('gridDiffusion2D: out must be a different array from u');
  const open = (i) => !mask || mask[i];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      const centre = u[i];
      if (!open(i)) {
        result[i] = centre;
        continue;
      }
      let flux = 0;
      if (col > 0 && open(i - 1)) flux += u[i - 1] - centre;
      if (col < width - 1 && open(i + 1)) flux += u[i + 1] - centre;
      if (row > 0 && open(i - width)) flux += u[i - width] - centre;
      if (row < height - 1 && open(i + width)) flux += u[i + width] - centre;
      result[i] = centre + rate * flux;
    }
  }
  return result;
}

/**
 * Runs `fn(params, post)` in a Web Worker and resolves with its return value (or the value
 * of the promise it returns). `fn` must be self-contained: it is sent to the worker as source
 * text, so it can use its arguments and worker globals but nothing from the surrounding module.
 * Inside, `post(value)` sends progress to `onMessage(value)` on the page.
 *
 * Options: onMessage, signal (an AbortSignal that terminates the worker), transfer (a list of
 * Transferables in `params`). Where workers are unavailable, fn runs on the current thread.
 */
export function runInWorker(fn, params, { onMessage, signal, transfer = [] } = {}) {
  if (typeof fn !== 'function') return Promise.reject(new TypeError('runInWorker: fn must be a function'));
  if (signal?.aborted) return Promise.reject(signal.reason);
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
    return Promise.resolve().then(() => fn(params, (value) => onMessage?.(value)));
  }

  const source = `"use strict";
const fn = (${fn.toString()});
const post = (value) => self.postMessage({ kind: "message", value });
self.onmessage = async (event) => {
  try {
    self.postMessage({ kind: "result", value: await fn(event.data, post) });
  } catch (error) {
    self.postMessage({ kind: "error", message: String(error && error.message || error) });
  }
};`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);

  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.terminate();
      URL.revokeObjectURL(url);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.kind === 'message') {
        onMessage?.(data.value);
      } else if (data.kind === 'result') {
        finish();
        resolve(data.value);
      } else {
        finish();
        reject(new Error(`runInWorker: ${data.message}`));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(new Error(`runInWorker: ${event.message || 'the worker failed to start'}`));
    };
    worker.postMessage(params, transfer);
  });
}
