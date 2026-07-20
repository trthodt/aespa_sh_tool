const countEl = document.getElementById("queue-count");
const statusEl = document.getElementById("queue-status");

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.startsWith("https://www.stationhead.com/")) {
    statusEl.textContent = "Open a Stationhead show to see the queue.";
    countEl.textContent = "-";
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_QUEUE_COUNT" });
    if (response?.count === null || response?.count === undefined) {
      statusEl.textContent = "No \"Up next\" queue found on this page.";
      countEl.textContent = "-";
    } else {
      statusEl.textContent = "Songs left in queue";
      countEl.textContent = response.count;
    }
  } catch (err) {
    statusEl.textContent = "Reload the Stationhead tab and try again.";
    countEl.textContent = "-";
  }
}

document.getElementById("btn-action").onclick = refresh;

document.getElementById("btn-show-popup").onclick = () => {
  chrome.storage.local.set({ sthPopupHidden: false, sthPopupMinimized: false });
};

refresh();
