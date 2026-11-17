// The standard demo chrome. mount() renders, top to bottom: title and tagline, a controls
// rail (left on wide frames, stacked above the stage on narrow ones), the stage, a status
// line, a collapsible "How this works", the model card (when there is one), and links to the
// repo and write-up.
//
// When the mount element carries data-embedded (the site's project pages set it), the page
// already shows the title, model card and links from the manifest, so the frame leaves
// them out and renders only the interactive part.

import { h } from './dom.js';
import { markdown } from './markdown.js';
import { getTheme, onThemeChange, token } from './theme.js';

// Standalone pages resolve the manifest's site-relative write-up path against the live site.
const SITE_URL = 'https://mark-bugden.github.io/';
// Longest step the animation clock takes in one frame, so a stall does not jump the demo ahead.
const MAX_DELTA = 0.1;

const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" fill="currentColor"/>',
  reset: '<path d="M5.5 12a6.5 6.5 0 1 0 1.9-4.6M5.5 4v3.9h3.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

function icon(name) {
  const span = h('span', { class: 'dk-icon', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" focusable="false">${ICONS[name]}</svg>`;
  return span;
}

let lastId = 0;

/**
 * Mounts the frame into `el` (replacing its contents) and returns a handle.
 *
 * Options:
 *   el         the mount element, <div data-demo="<slug>">
 *   manifest   the demo's manifest.json; supplies the defaults for title, tagline, about,
 *              modelCard, links and height
 *   title, tagline, about (Markdown), modelCard, links ({ repo, writeup }), height (px)
 *              override the manifest
 *   controls   { name: control } from slider(), toggle(), select(), preset()
 *   stage      'div' (default) or 'canvas'
 *   animate    true to run an animation loop with Play/Pause; it starts paused under
 *              prefers-reduced-motion and stops while the stage is off screen
 *   render     render(state), called on start, on control changes, resizes and theme
 *              changes, and on every frame while playing. state: { stage, width, height,
 *              pixelRatio, values, theme, time, delta, reason, token }
 *   reset      called by the Reset button (shown when animating or when reset is given)
 *   status     initial text for the status line
 *
 * Handle: { stage, play(), pause(), playing, status(text), redraw(), destroy() }
 */
export function mount(options = {}) {
  const {
    el, manifest = {}, controls = {}, render = () => {}, reset,
    animate = false, stage: stageKind = 'div', status = '',
  } = options;
  if (!(el instanceof Element)) throw new TypeError('mount(): `el` must be the demo\'s mount element');

  const title = options.title ?? manifest.title;
  const tagline = options.tagline ?? manifest.tagline;
  const about = options.about ?? manifest.about;
  const modelCard = options.modelCard ?? manifest.modelCard;
  const links = options.links ?? { repo: manifest.repo, writeup: manifest.writeup };
  const stageHeight = options.height ?? manifest.demo?.height ?? 480;
  const embedded = el.hasAttribute('data-embedded');
  const id = `dk-frame-${++lastId}`;

  // Stage
  const stage = stageKind === 'canvas'
    ? h('canvas', { class: 'dk-stage-content', role: 'img', 'aria-label': title ?? 'Demo' })
    : h('div', { class: 'dk-stage-content' });
  const stageBox = h('div', { class: 'dk-stage' }, stage);
  stageBox.style.setProperty('--dk-stage-height', `${stageHeight}px`);

  // Transport and status line
  const statusEl = h('p', { class: 'dk-status' }, status);
  const playButton = animate ? h('button', { type: 'button', class: 'dk-button dk-button-primary' }) : null;
  const resetButton = animate || reset ? h('button', { type: 'button', class: 'dk-button' }, icon('reset'), 'Reset') : null;

  // Controls rail
  const controlList = Object.values(controls);
  const rail = controlList.length
    ? h('div', { class: 'dk-rail', role: 'group', 'aria-label': 'Controls' }, ...controlList.map((control) => control.el))
    : null;

  // How this works
  let aboutEl = null;
  if (about) {
    const prose = h('div', { class: 'dk-prose' });
    prose.innerHTML = markdown(about);
    aboutEl = h('details', { class: 'dk-about' }, h('summary', {}, 'How this works'), prose);
  }

  el.replaceChildren(...[
    !embedded && title ? h('header', { class: 'dk-header' },
      h('h1', { class: 'dk-title' }, title),
      tagline ? h('p', { class: 'dk-tagline' }, tagline) : null) : null,
    h('div', { class: rail ? 'dk-body' : 'dk-body dk-body-full' },
      rail,
      h('div', { class: 'dk-main' }, stageBox, h('div', { class: 'dk-bar' }, playButton, resetButton, statusEl))),
    aboutEl,
    !embedded && modelCard ? modelCardSection(modelCard, `${id}-card`) : null,
    !embedded ? linkList(links) : null,
  ].filter(Boolean));

  // Rendering: one requestAnimationFrame loop serves both animation and redraws.
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let playing = animate && !reduceMotion;
  let visible = true;
  let time = 0;
  let last = null;
  let raf = 0;
  let pending = 'init';
  let size = measure();

  function measure() {
    const rect = stage.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function draw(reason, delta) {
    const pixelRatio = globalThis.devicePixelRatio || 1;
    if (stage instanceof HTMLCanvasElement) {
      const width = Math.max(1, Math.round(size.width * pixelRatio));
      const height = Math.max(1, Math.round(size.height * pixelRatio));
      if (stage.width !== width) stage.width = width;
      if (stage.height !== height) stage.height = height;
    }
    const values = Object.fromEntries(Object.entries(controls).map(([name, control]) => [name, control.value]));
    try {
      render({
        stage, width: size.width, height: size.height, pixelRatio, values,
        theme: getTheme(), time, delta, reason, token: (name) => token(stage, name),
      });
    } catch (error) {
      pause();
      throw error;
    }
  }

  function loop(now) {
    raf = 0;
    const running = animate && playing && visible;
    let delta = 0;
    if (running) {
      delta = last === null ? 0 : Math.min((now - last) / 1000, MAX_DELTA);
      last = now;
      time += delta;
    } else {
      last = null;
    }
    const reason = pending ?? (running ? 'tick' : null);
    pending = null;
    if (reason) draw(reason, delta);
    if (running) schedule();
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function invalidate(reason) {
    pending ??= reason;
    schedule();
  }

  function showPlayState() {
    playButton?.replaceChildren(icon(playing ? 'pause' : 'play'), playing ? 'Pause' : 'Play');
  }

  function play() {
    if (!animate || playing) return;
    playing = true;
    showPlayState();
    schedule();
  }

  function pause() {
    if (!playing) return;
    playing = false;
    showPlayState();
  }

  playButton?.addEventListener('click', () => (playing ? pause() : play()));
  resetButton?.addEventListener('click', () => {
    time = 0;
    last = null;
    reset?.();
    invalidate('reset');
  });
  showPlayState();

  const unsubscribe = [
    onThemeChange(() => invalidate('theme')),
    ...controlList.map((control) => control.onChange(() => invalidate('controls'))),
  ];

  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    const next = measure();
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    invalidate('resize');
  });
  resizeObserver?.observe(stage);

  const visibilityObserver = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) schedule();
  });
  visibilityObserver?.observe(stageBox);

  schedule();

  return {
    stage,
    play,
    pause,
    get playing() { return playing; },
    status(text) { statusEl.textContent = text; },
    redraw() { invalidate('redraw'); },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      for (const off of unsubscribe) off();
      el.replaceChildren();
    },
  };
}

function modelCardSection(card, headingId) {
  const rows = [
    ['What it computes', card.what],
    ['Data', card.data],
    ['Held-out performance', card.metric],
    ['Known limits', card.limits?.length ? h('ul', {}, ...card.limits.map((limit) => h('li', {}, limit))) : null],
  ].filter(([, value]) => value != null && value !== '');
  return h('section', { class: 'dk-card', 'aria-labelledby': headingId },
    h('h2', { id: headingId, class: 'dk-card-title' }, 'Model card'),
    h('dl', { class: 'dk-card-list' }, ...rows.map(([term, value]) => h('div', {}, h('dt', {}, term), h('dd', {}, value)))));
}

function linkList({ repo, writeup } = {}) {
  const items = [
    repo && ['Source code on GitHub', repo],
    writeup && ['Read the write-up', new URL(writeup, SITE_URL).href],
  ].filter(Boolean);
  if (!items.length) return null;
  return h('nav', { class: 'dk-links', 'aria-label': 'Project links' },
    ...items.map(([label, href]) => h('a', { href, rel: 'noopener' }, label)));
}
