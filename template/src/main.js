// The demo's entry point. Vite bundles it with the kit and the CSS into demo.js and demo.css.
// Everything below the imports is a placeholder: replace the controls and the drawing code
// with the real demo, and keep the mount() call.

import manifest from 'virtual:manifest';
import { mount, select, slider, toggle } from '@mark-bugden/demo-kit';
import '@mark-bugden/demo-kit/tokens.scoped.css';
import '@mark-bugden/demo-kit/frame.css';

const controls = {
  ratio: select({
    label: 'Frequency ratio',
    options: [
      { label: '3 : 2', value: [3, 2] },
      { label: '5 : 4', value: [5, 4] },
      { label: '1 : 2', value: [1, 2] },
    ],
  }),
  speed: slider({ label: 'Speed', min: 0.25, max: 2, step: 0.25, value: 1, format: (v) => `${v.toFixed(2)}×` }),
  curve: toggle({ label: 'Show full curve', value: true }),
  // A planned control, shown disabled until the demo supports it.
  planned: slider({ label: 'Planned control', disabled: true }),
};

let phase = 0;
let colors = null;

const frame = mount({
  el: document.querySelector(`[data-demo="${manifest.slug}"]`),
  manifest,
  controls,
  stage: 'canvas',
  animate: true,
  reset: () => { phase = 0; },
  render({ stage, width, height, pixelRatio, values, delta, reason, token }) {
    phase += delta * values.speed;
    if (!colors || reason === 'theme') {
      colors = { accent: token('--color-accent'), muted: token('--color-muted'), border: token('--color-border'), surface: token('--color-surface') };
    }
    const [a, b] = values.ratio;
    drawLissajous(stage.getContext('2d'), { width, height, pixelRatio, a, b, showCurve: values.curve });
    frame.status(`Placeholder stage · a : b = ${a} : ${b} · t = ${phase.toFixed(1)}`);
  },
});

function drawLissajous(ctx, { width, height, pixelRatio, a, b, showCurve }) {
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.min(width * 0.4, height * 0.6);
  const ry = height * 0.36;
  const point = (t) => [cx + rx * Math.sin(a * t + Math.PI / 2), cy + ry * Math.sin(b * t)];

  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.border;
  ctx.beginPath();
  ctx.moveTo(cx - rx - 16, cy);
  ctx.lineTo(cx + rx + 16, cy);
  ctx.moveTo(cx, cy - ry - 16);
  ctx.lineTo(cx, cy + ry + 16);
  ctx.stroke();

  if (showCurve) {
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colors.muted;
    ctx.beginPath();
    for (let i = 0; i <= 720; i++) ctx.lineTo(...point((i / 720) * 2 * Math.PI));
    ctx.stroke();
  }

  // A trail that fades in towards the moving point.
  const trail = 2.4;
  const segments = 80;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = colors.accent;
  for (let i = 0; i < segments; i++) {
    ctx.globalAlpha = (i + 1) / segments;
    ctx.beginPath();
    ctx.moveTo(...point(phase - trail * (1 - i / segments)));
    ctx.lineTo(...point(phase - trail * (1 - (i + 1) / segments)));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const [x, y] = point(phase);
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, 2 * Math.PI);
  ctx.fillStyle = colors.accent;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.surface;
  ctx.stroke();
}
