// The extension can be reloaded/updated while a Stationhead tab is already
// open. The content script already injected into that tab keeps running,
// but chrome.runtime/chrome.storage calls from it now throw "Extension
// context invalidated" since they point at a dead extension instance - the
// only real fix is refreshing the page. Surface that clearly instead of
// letting it fail silently in the console.
let bannerShown = false;

function showReloadBanner() {
  if (bannerShown) return;
  bannerShown = true;

  const banner = document.createElement("div");
  banner.textContent = "Stationhead extension was updated - please refresh this page (F5) to keep using it.";
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    zIndex: "2147483647",
    background: "#dc2626",
    color: "#fff",
    padding: "8px",
    textAlign: "center",
    fontFamily: "sans-serif",
    fontSize: "13px",
  });
  document.body.appendChild(banner);
}

export function isExtensionContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function isContextInvalidatedError(err) {
  return String(err?.message ?? err).includes("Extension context invalidated");
}

// Wraps a chrome.* API call so a dead extension context shows the banner
// instead of throwing an uncaught error.
export async function guardExtensionCall(fn) {
  if (!isExtensionContextValid()) {
    showReloadBanner();
    return null;
  }
  try {
    return await fn();
  } catch (err) {
    if (isContextInvalidatedError(err)) {
      showReloadBanner();
      return null;
    }
    throw err;
  }
}
