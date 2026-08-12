// The site's class names are regenerated on every deploy, so we locate the
// queue by its visible section header text instead of relying on any class
// name. Each queued track (but not the "Now playing" row) renders a drag
// handle with a stable "cursor-grab" class, so that's what we count.
export function computeQueueCount(doc = document) {
  const headers = Array.from(doc.querySelectorAll("span"));
  const queueHeader = headers.find((span) => span.textContent?.trim() === "Next in show playlist");
  if (!queueHeader) return null;

  const section = queueHeader.closest("section");
  if (!section) return null;

  return section.querySelectorAll(".cursor-grab").length;
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
