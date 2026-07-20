let state = { count: null, updatedAt: null };
const listeners = new Set();

export function setQueueCount(count) {
  state = { count, updatedAt: Date.now() };
  listeners.forEach((fn) => fn(state));
}

export function getQueueState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
