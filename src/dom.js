// Internal DOM helper shared by the frame and the controls; not part of the public API.

/** Creates an element. Attributes set to false or null are skipped; true sets an empty attribute. */
export function h(tag, attributes = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value == null) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  el.append(...children.filter((child) => child != null && child !== false));
  return el;
}
