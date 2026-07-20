export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitFor(predicate, { timeout = 8000, interval = 150 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const result = predicate();
      if (result) {
        resolve(result);
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error("Timed out waiting for element"));
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  });
}

export function findByExactText(tag, text, root = document) {
  const matches = Array.from(root.querySelectorAll(tag)).filter((el) => el.textContent?.trim() === text);
  // A wrapper whose only child holds the text will match too and comes first
  // in document order (querySelectorAll is preorder) - prefer the innermost
  // match, i.e. the one that doesn't itself contain another match.
  return matches.find((el) => !matches.some((other) => other !== el && el.contains(other))) ?? matches[0];
}

export function findButtonByText(text, root = document) {
  return findByExactText("button", text, root);
}

export function findButtonStartingWith(prefix, root = document) {
  const needle = prefix.trim().toLowerCase();
  return Array.from(root.querySelectorAll("button")).find((b) =>
    b.textContent?.trim().toLowerCase().startsWith(needle)
  );
}

// Some handlers are wired to pointer/mouse events rather than a plain
// "click", so a bare el.click() can silently no-op. Fire the full sequence
// a real click produces instead.
export function simulateClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const opts = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  el.dispatchEvent(new PointerEvent("pointerdown", opts));
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new PointerEvent("pointerup", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.dispatchEvent(new MouseEvent("click", opts));
}
