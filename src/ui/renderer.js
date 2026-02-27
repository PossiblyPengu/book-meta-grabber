/**
 * Lightweight render helper. Updates innerHTML only when content changes.
 */
const cache = new WeakMap();

export function render(container, html) {
  if (cache.get(container) === html) return;
  cache.set(container, html);
  container.innerHTML = html;
}

export function $(selector, scope = document) {
  return scope.querySelector(selector);
}

export function $$(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}
