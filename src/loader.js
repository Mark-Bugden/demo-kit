// Loads a demo's data files relative to the demo's own folder, so the same call works in the
// standalone index.html, embedded in the site under /demos/<slug>/, and in `npm run dev`.

const moduleUrl = import.meta.url;

function defaultBase() {
  // In a built demo this module is bundled into demo.js, so its URL is the demo's folder.
  // Under the Vite dev server the kit is served from node_modules (or /@fs/), and the
  // demo's public files sit at the page's own URL instead.
  return /\/node_modules\/|\/@fs\//.test(new URL(moduleUrl).pathname) ? document.baseURI : moduleUrl;
}

async function get(url, base, signal) {
  const href = new URL(url, base ?? defaultBase()).href;
  const response = await fetch(href, { signal });
  if (!response.ok) throw new Error(`Could not load ${href}: ${response.status} ${response.statusText}`.trim());
  return response;
}

/** Fetches and parses a JSON file, e.g. loadJSON('data/episodes.json'). Options: base, signal. */
export async function loadJSON(url, { base, signal } = {}) {
  return (await get(url, base, signal)).json();
}

/**
 * Fetches a CSV file with a header row and returns one object per row.
 * With `typed` (the default), numeric fields become numbers and empty fields become null;
 * everything else stays a string. Options: base, signal, typed.
 */
export async function loadCSV(url, { base, signal, typed = true } = {}) {
  const [header = [], ...rows] = parseRows(await (await get(url, base, signal)).text());
  const convert = typed ? autoType : (value) => value;
  return rows
    .filter((row) => row.length > 1 || row[0] !== '')
    .map((row) => Object.fromEntries(header.map((name, i) => [name, convert(row[i] ?? '')])));
}

const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function autoType(value) {
  if (value === '') return null;
  return NUMBER.test(value.trim()) ? Number(value) : value;
}

// RFC 4180: comma-separated, "double quotes" around fields that contain commas, quotes
// ("" inside) or line breaks; LF or CRLF line endings; an optional byte-order mark.
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
