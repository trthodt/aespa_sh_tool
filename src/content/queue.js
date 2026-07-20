// Stationhead's DOM uses styled-components class names that are regenerated
// on every deploy, so we locate the "Up next" queue by its visible text
// instead of relying on any class name.
export function computeQueueCount(doc = document) {
  const headers = Array.from(doc.querySelectorAll("p"));
  const upNextHeader = headers.find((p) => p.textContent?.trim() === "Up next");
  if (!upNextHeader) return null;

  const headerRow = upNextHeader.parentElement;
  const container = headerRow?.parentElement;
  if (!container) return null;

  return container.querySelectorAll('[draggable="true"]').length;
}

export function watchQueue(onChange, { debounceMs = 250 } = {}) {
  let timer = null;
  let lastCount;

  const check = () => {
    const count = computeQueueCount();
    if (count !== lastCount) {
      lastCount = count;
      onChange(count);
    }
  };

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(check, debounceMs);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  check();

  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
