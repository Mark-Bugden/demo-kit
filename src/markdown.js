// A deliberately small Markdown subset for the frame's "How this works" panel:
// paragraphs, - and 1. lists, **strong**, *em* / _em_, `code` and [links](url).
// Headings become bold paragraphs, so the panel never breaks the host page's heading order.
// Internal to the kit; not part of the public API.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Relative URLs, http(s) and mailto only; anything else (javascript:, data:) loses its link.
const isSafeHref = (href) => !/^[a-z][a-z0-9+.-]*:/i.test(href) || /^(https?|mailto):/i.test(href);

const emphasis = (html) => html
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
  .replace(/(^|[^\w])_([^_\s][^_]*)_(?=[^\w]|$)/g, '$1<em>$2</em>');

function inline(text) {
  // Code spans and links are set aside first so emphasis never reaches into them.
  const kept = [];
  const keep = (html) => `${kept.push(html) - 1}`;
  let html = emphasis(escapeHtml(text)
    .replace(/`([^`]+)`/g, (_, content) => keep(`<code>${content}</code>`))
    .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, href) =>
      isSafeHref(href) ? keep(`<a href="${href}" rel="noopener">${emphasis(label)}</a>`) : label));
  while (html.includes('')) html = html.replace(/(\d+)/g, (_, i) => kept[i]);
  return html;
}

const BULLET = /^\s*[-*+]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^#{1,6}\s+/;

/** Renders the subset to an HTML string. Input is escaped, so it is safe for innerHTML. */
export function markdown(source = '') {
  return source
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => BULLET.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inline(line.replace(BULLET, ''))}</li>`).join('')}</ul>`;
      }
      if (lines.every((line) => NUMBERED.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inline(line.replace(NUMBERED, ''))}</li>`).join('')}</ol>`;
      }
      if (lines.length === 1 && HEADING.test(lines[0])) {
        return `<p><strong>${inline(lines[0].replace(HEADING, ''))}</strong></p>`;
      }
      return `<p>${inline(lines.map((line) => line.trim()).join(' '))}</p>`;
    })
    .join('\n');
}
