// Stationhead's class names (sc-xxxxx) are regenerated on every deploy, so
// every lookup here matches on visible text/structure instead.
import {
  sleep,
  waitFor,
  findByExactText,
  findButtonByText,
  findButtonStartingWith,
  simulateClick,
} from "./dom";
import { computeQueueCount } from "./queue";
import { ensureNetworkHookInstalled, waitForQueueSettled } from "./networkQueueSignal";

const log = (...args) => console.log("[SH-ext]", ...args);

function getUpNextAddButton() {
  const header = findByExactText("p", "Up next");
  const headerRow = header?.parentElement;
  return headerRow?.querySelector('button[aria-label="add"]') ?? null;
}

// When the queue is empty there is no "Up next" header at all - instead
// Stationhead shows an "Add some music" call-to-action button.
function getEmptyQueueAddButton() {
  return findButtonByText("Add some music");
}

function getAddMusicButton() {
  return getUpNextAddButton() ?? getEmptyQueueAddButton();
}

function getMyPlaylistsListContainer() {
  const label = findByExactText("div", "My playlists");
  return label?.parentElement?.nextElementSibling ?? null;
}

function findPlaylistRow(name) {
  const listContainer = getMyPlaylistsListContainer();
  if (!listContainer) return null;

  const needle = name.trim().toLowerCase();
  const rows = Array.from(listContainer.querySelectorAll('div[style*="cursor: pointer"]'));
  return rows.find((row) => row.querySelector("p")?.textContent?.trim().toLowerCase().includes(needle)) ?? null;
}

async function findPlaylistRowWithScroll(name, { attempts = 5, scrollDelay = 400 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const row = findPlaylistRow(name);
    if (row) return row;
    getMyPlaylistsListContainer()?.scrollBy?.(0, 600);
    await sleep(scrollDelay);
  }
  return findPlaylistRow(name);
}

// The queue count only moves once Stationhead finishes actually queuing the
// tracks server-side, which for a big playlist (dozens of tracks) can take a
// while - so we confirm success by polling the real count instead of
// guessing a timeout.
async function waitForCountIncrease(startCount, { timeout = 30000, interval = 500 } = {}) {
  const baseline = startCount ?? 0;
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const current = computeQueueCount();
    if (current !== null && current > baseline) {
      return current;
    }
    await sleep(interval);
  }
  return null;
}

// Prefer the network response (the actual /me/queue/track/later call) since
// it's an authoritative, immediate signal; fall back to DOM polling in case
// the page-world hook failed to install for some reason. Whichever confirms
// first wins; only report failure if both come back empty.
async function waitForAddConfirmation(startCount, { timeout = 30000 } = {}) {
  const netPromise = waitForQueueSettled(startCount, { timeout }).then((result) =>
    result ? { source: "network", count: result.count } : null
  );
  const domPromise = waitForCountIncrease(startCount, { timeout }).then((count) =>
    count !== null ? { source: "dom", count } : null
  );

  return new Promise((resolve) => {
    let remaining = 2;
    let settled = false;
    const consider = (value) => {
      if (settled) return;
      if (value) {
        settled = true;
        resolve(value);
        return;
      }
      remaining -= 1;
      if (remaining === 0) resolve(null);
    };
    netPromise.then(consider);
    domPromise.then(consider);
  });
}

// The "Add music" h3 only exists on the modal's root search screen - once a
// playlist is opened that screen (and its h3) is gone even though the modal
// itself (now showing Back/Close + the track list) is still open. The
// "Close" button, unlike the h3, is present on every screen of the modal, so
// its absence is the only reliable "fully closed" signal.
async function closeAddMusicModal({ attempts = 12, delay = 500 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const closeBtn = findButtonByText("Close");
    if (!closeBtn) {
      log(`Modal closed (confirmed after ${i} attempt(s))`);
      return true;
    }
    log(`Close attempt ${i + 1}/${attempts}`, closeBtn);
    simulateClick(closeBtn);
    await sleep(delay);
  }
  const stillOpen = !!findButtonByText("Close");
  log(stillOpen ? "Modal still open after all close attempts - giving up" : "Modal closed on final check");
  return !stillOpen;
}

export async function addPlaylistToQueue(playlistName, { onStatus } = {}) {
  const notify = (message) => {
    log(message);
    onStatus?.(message);
  };

  if (!playlistName?.trim()) {
    throw new Error("No playlist name configured");
  }

  await ensureNetworkHookInstalled();

  const startCount = computeQueueCount();
  log("Queue count before adding:", startCount);

  notify("Opening add music...");
  const addButton = getAddMusicButton();
  if (!addButton) {
    throw new Error('Could not find an "add music" button on this page');
  }
  simulateClick(addButton);

  await waitFor(() => findByExactText("h3", "Add music"));
  await sleep(300);

  notify(`Looking for playlist "${playlistName}"...`);
  const row = await findPlaylistRowWithScroll(playlistName);
  if (!row) {
    await closeAddMusicModal();
    throw new Error(`Playlist "${playlistName}" not found in your saved playlists`);
  }
  log("Found playlist row, clicking it", row);
  simulateClick(row);

  notify("Opening playlist...");
  await waitFor(() => findButtonStartingWith("All songs"), { timeout: 5000 });
  // The button renders before the track list data behind it has finished
  // loading - give it a moment to settle before clicking.
  await sleep(900);

  const allSongsBtn = findButtonStartingWith("All songs");
  if (!allSongsBtn) {
    throw new Error('"All songs" button disappeared before it could be clicked');
  }
  log("Clicking All songs", allSongsBtn);
  simulateClick(allSongsBtn);

  notify("Waiting for songs to be added...");
  const confirmation = await waitForAddConfirmation(startCount);

  const closed = await closeAddMusicModal();
  log("closeAddMusicModal result:", closed);

  if (!confirmation) {
    throw new Error(
      `Clicked "All songs" but never saw confirmation (was ${startCount ?? 0} songs). It may still be loading - check Stationhead directly.`
    );
  }

  notify(
    `Done (${confirmation.source}) - queue now has ${confirmation.count} songs${closed ? "" : " (modal still open)"}`
  );
}
