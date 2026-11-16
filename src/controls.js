// Control helpers for the frame's rail. Each returns { el, value, disabled, onChange }:
//   el          the element to place (mount() does this for you)
//   value       read or set the current value; setting it updates the UI but does not notify
//   disabled    read or set; use disabled controls as placeholders for planned features
//   onChange    onChange(fn) calls fn(value) on user input and returns an unsubscribe function

import { h } from './dom.js';

let lastId = 0;
const nextId = (kind) => `dk-${kind}-${++lastId}`;

function requireLabel(kind, label) {
  if (typeof label !== 'string' || !label.trim()) throw new TypeError(`${kind}(): \`label\` is required`);
}

function control({ el, inputs, read, write, event = 'change', disabled }) {
  const listeners = new Set();
  const notify = () => {
    const value = read();
    for (const listener of listeners) listener(value);
  };
  const setDisabled = (state) => {
    for (const input of inputs) input.disabled = state;
    el.toggleAttribute('data-disabled', state);
  };
  for (const input of inputs) input.addEventListener(event, notify);
  setDisabled(disabled);
  return {
    el,
    get value() { return read(); },
    set value(value) { write(value); },
    get disabled() { return el.hasAttribute('data-disabled'); },
    set disabled(state) { setDisabled(Boolean(state)); },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** A labelled range input with its formatted value beside the label. */
export function slider({ label, min = 0, max = 1, step = 0.01, value = min, format = String, disabled = false } = {}) {
  requireLabel('slider', label);
  const id = nextId('slider');
  const input = h('input', { id, type: 'range', min, max, step, value });
  const output = h('output', { for: id, class: 'dk-control-value', 'aria-hidden': 'true' });
  const el = h('div', { class: 'dk-control dk-slider' },
    h('div', { class: 'dk-control-head' }, h('label', { for: id, class: 'dk-control-label' }, label), output),
    input);
  const read = () => Number(input.value);
  const show = () => {
    output.textContent = format(read());
    input.setAttribute('aria-valuetext', output.textContent);
  };
  input.addEventListener('input', show);
  show();
  return control({
    el, inputs: [input], read, event: 'input', disabled,
    write: (next) => { input.value = String(next); show(); },
  });
}

/** An on/off switch. */
export function toggle({ label, value = false, disabled = false } = {}) {
  requireLabel('toggle', label);
  const input = h('input', { type: 'checkbox', role: 'switch', checked: Boolean(value) });
  const el = h('label', { class: 'dk-control dk-toggle' }, input, h('span', { class: 'dk-control-label' }, label));
  return control({
    el, inputs: [input], disabled,
    read: () => input.checked,
    write: (next) => { input.checked = Boolean(next); },
  });
}

/** A drop-down. `options` are strings or { label, value } pairs; values may be of any type. */
export function select({ label, options = [], value, disabled = false } = {}) {
  requireLabel('select', label);
  const items = options.map((option) =>
    option !== null && typeof option === 'object' ? option : { label: String(option), value: option });
  const id = nextId('select');
  const input = h('select', { id }, ...items.map((item, i) => h('option', { value: i }, item.label)));
  const el = h('div', { class: 'dk-control dk-select' },
    h('label', { for: id, class: 'dk-control-label' }, label),
    input);
  const write = (next) => {
    const index = items.findIndex((item) => Object.is(item.value, next));
    if (index >= 0) input.selectedIndex = index;
  };
  if (value !== undefined) write(value);
  return control({
    el, inputs: [input], disabled, write,
    read: () => items[input.selectedIndex]?.value,
  });
}

/**
 * A row of buttons that each apply a named preset. `options` are { label, value } pairs;
 * `value` is the last preset chosen (null until one is). Apply the preset's settings to
 * the other controls in onChange.
 */
export function preset({ label, options = [], disabled = false } = {}) {
  requireLabel('preset', label);
  const id = nextId('preset');
  let chosen = null;
  const buttons = options.map((option) => {
    const button = h('button', { type: 'button', class: 'dk-button' }, option.label);
    button.addEventListener('click', () => { chosen = option.value; });
    return button;
  });
  const el = h('div', { class: 'dk-control dk-preset', role: 'group', 'aria-labelledby': id },
    h('span', { id, class: 'dk-control-label' }, label),
    h('div', { class: 'dk-preset-list' }, ...buttons));
  return control({
    el, inputs: buttons, event: 'click', disabled,
    read: () => chosen,
    write: (next) => { chosen = next; },
  });
}
