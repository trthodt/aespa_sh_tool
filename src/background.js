import { installQueueHook } from "./content/networkHookScript";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "INJECT_QUEUE_HOOK" && sender.tab?.id) {
    chrome.scripting
      .executeScript({
        target: { tabId: sender.tab.id },
        world: "MAIN",
        func: installQueueHook,
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  sendResponse({ status: "ok" });
});
