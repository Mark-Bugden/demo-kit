// A thin wrapper over Observable Plot that applies the kit's tokens and theme.
// Fonts, ink and the tooltip background come from frame.css (via the .dk-chart class), so
// they follow theme changes without a re-render. Plot is re-exported so every demo builds
// its marks against the same Plot the wrapper uses.

import * as Plot from '@observablehq/plot';
import { token } from './theme.js';

export { Plot };

// Categorical slots as CSS variables: Plot passes them straight through to SVG attributes,
// so series colours switch with the theme on their own.
const CATEGORICAL = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);
const CONTINUOUS = new Set(['linear', 'sqrt', 'pow', 'log', 'symlog']);

/**
 * Renders a Plot spec into `el`, replacing its contents, and returns the chart element.
 * Defaults: width fills `el`; a categorical colour scale uses --chart-1… in order; a
 * continuous one runs --chart-seq-low → --chart-seq-high. Anything set in `spec` wins.
 * Call it from your render callback so the chart follows resizes and theme changes.
 */
export function plot(spec, el) {
  el.classList.add('dk-chart');
  const style = getComputedStyle(el);
  const width = Math.floor(el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  const options = { width: width > 0 ? width : 640, ...spec };
  let chart = Plot.plot(options);

  const color = spec.color ?? {};
  if (!(color.range || color.scheme || color.interpolate)) {
    const type = chart.scale('color')?.type;
    // Plot reports categorical scales (inferred from strings) as "ordinal"; an ordinal scale
    // the spec asked for explicitly keeps Plot's ordered default.
    if (type === 'ordinal' && color.type !== 'ordinal') {
      chart = Plot.plot({ ...options, color: { ...color, range: CATEGORICAL } });
    } else if (CONTINUOUS.has(type) && el.isConnected) {
      // Interpolation needs real colours, so these are resolved now; a theme change
      // re-renders through the frame and picks up the other theme's values.
      const range = [token(el, '--chart-seq-low'), token(el, '--chart-seq-high')];
      if (range.every(Boolean)) chart = Plot.plot({ ...options, color: { ...color, range, interpolate: 'lab' } });
    }
  }

  el.replaceChildren(chart);
  return chart;
}
