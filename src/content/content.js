import { mountApp } from "../webpopup/MountComp";
import { computeQueueCount, watchQueue } from "./queue";
import { setQueueCount } from "./queueStore";
import { maybeAutoTrigger } from "./autoAdd";
import { ensureNetworkHookInstalled } from "./networkQueueSignal";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_QUEUE_COUNT") {
    sendResponse({ count: computeQueueCount() });
  }
});

function createPopup() {
  if (document.getElementById("ext-root")) return;

  const container = document.createElement("div");
  container.id = "ext-root";
  document.body.appendChild(container);

  mountApp("#ext-root");
}

createPopup();
ensureNetworkHookInstalled();

watchQueue(async (count) => {
  setQueueCount(count);
  chrome.storage.local.set({ sthQueueCount: count, sthQueueUpdatedAt: Date.now() });

  const { sthPlaylistName, sthAutoAddThreshold, sthAutoAddEnabled } = await chrome.storage.local.get([
    "sthPlaylistName",
    "sthAutoAddThreshold",
    "sthAutoAddEnabled",
  ]);
  maybeAutoTrigger(count, sthPlaylistName, sthAutoAddThreshold, sthAutoAddEnabled !== false);
});
