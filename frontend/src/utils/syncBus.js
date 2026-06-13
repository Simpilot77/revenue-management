// Lightweight cross-page sync: components emit data-change events after mutating
// localStorage / shared in-memory data, other pages subscribe to refresh themselves.
const EVENT = 'app:data-changed';

export function emitDataChange(detail) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail }));
}

export function onDataChange(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
