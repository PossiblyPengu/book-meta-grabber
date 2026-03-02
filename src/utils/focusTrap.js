/**
 * Simple focus trap for modals and overlays.
 * Call `trapFocus(container)` when opening; returns a cleanup function.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function trapFocus(container) {
  if (!container) return () => {};

  const previouslyFocused = document.activeElement;

  const focusables = () =>
    [...container.querySelectorAll(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null
    );

  // Focus first focusable element
  requestAnimationFrame(() => {
    const els = focusables();
    if (els.length) els[0].focus();
  });

  function onKeyDown(e) {
    if (e.key !== 'Tab') return;
    const els = focusables();
    if (!els.length) return;

    const first = els[0];
    const last = els[els.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', onKeyDown);

  return function release() {
    container.removeEventListener('keydown', onKeyDown);
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
  };
}
