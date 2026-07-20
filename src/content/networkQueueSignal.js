const listeners = new Set();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "sh-ext-net" || data.type !== "QUEUE_RESPONSE") return;

  const count = Array.isArray(data.payload?.queue_tracks) ? data.payload.queue_tracks.length : null;
  listeners.forEach((fn) => fn({ count, payload: data.payload }));
});

export function subscribeNetworkQueue(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ensureNetworkHookInstalled() {
  return chrome.runtime.sendMessage({ action: "INJECT_QUEUE_HOOK" }).catch(() => null);
}

// The "track/later" endpoint name suggests it may fire once per track rather
// than once for the whole playlist, so instead of resolving on the first
// response we wait until responses stop arriving for `quietMs` - that treats
// a burst of N sequential calls as one finished batch.
export function waitForQueueSettled(startCount, { quietMs = 1200, timeout = 30000 } = {}) {
  const baseline = startCount ?? 0;

  return new Promise((resolve) => {
    let lastCount = null;
    let quietTimer = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(quietTimer);
      clearTimeout(overallTimer);
      unsubscribe();
      resolve(lastCount !== null && lastCount > baseline ? { count: lastCount } : null);
    };

    const overallTimer = setTimeout(finish, timeout);

    const unsubscribe = subscribeNetworkQueue((value) => {
      if (value.count === null) return;
      lastCount = value.count;
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    });
  });
}
