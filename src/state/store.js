/**
 * Centralized reactive store with pub/sub.
 * Components subscribe to specific keys and re-render only when those change.
 */

const listeners = new Map();
let state = {};

export function getState() {
  return state;
}

export function setState(partial) {
  const changed = [];
  for (const key of Object.keys(partial)) {
    if (state[key] !== partial[key]) {
      changed.push(key);
    }
  }
  if (changed.length === 0) return;

  state = { ...state, ...partial };

  for (const key of changed) {
    const subs = listeners.get(key);
    if (subs) subs.forEach((fn) => fn(state));
  }
  // Wildcard subscribers
  const all = listeners.get('*');
  if (all) all.forEach((fn) => fn(state, changed));
}

/**
 * Subscribe to state changes.
 * @param {string|string[]} keys - State keys to watch, or '*' for all.
 * @param {Function} callback - Called with (state, changedKeys?)
 * @returns {Function} Unsubscribe function
 */
export function subscribe(keys, callback) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(callback);
  }
  return () => {
    for (const key of keyList) {
      listeners.get(key)?.delete(callback);
    }
  };
}

export function initState(initial) {
  state = { ...initial };
}
