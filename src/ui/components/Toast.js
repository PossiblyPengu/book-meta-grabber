let container = null;

function ensureContainer() {
  if (container && container.isConnected) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

export function showToast(message, type = 'info', ms = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  ensureContainer().appendChild(el);

  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, ms);
}
