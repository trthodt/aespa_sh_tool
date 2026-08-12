// The site's class names are regenerated on every deploy, so every lookup
// here matches on visible text/structure instead.
import { sleep, waitFor, findByExactText, findButtonByText, simulateClick } from "./dom";
import { computeQueueCount } from "./queue";
import { ensureNetworkHookInstalled, waitForQueueSettled } from "./networkQueueSignal";

const log = (...args) => console.log("[SH-ext]", ...args);

function getAddMusicButton() {
  return findButtonByText("Add music");
}

function getLibraryButton() {
  return findButtonByText("My Spotify Library");
}

function getPlaylistsListContainer() {
  const header = findByExactText("h4", "Playlists");
  return header?.nextElementSibling ?? null;
}

function findPlaylistRow(name) {
  const listContainer = getPlaylistsListContainer();
  if (!listContainer) return null;

  const needle = name.trim().toLowerCase();
  const rows = Array.from(listContainer.querySelectorAll("button"));
  return (
    rows.find((row) => row.querySelector(".body-2")?.textContent?.trim().toLowerCase().includes(needle)) ?? null
  );
}

// The playlist strip scrolls horizontally and isn't necessarily fully
// rendered up front, so scroll it into view a bit at a time while looking.
async function findPlaylistRowWithScroll(name, { attempts = 5, scrollDelay = 400 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const row = findPlaylistRow(name);
    if (row) return row;
    getPlaylistsListContainer()?.scrollBy?.(600, 0);
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

// The "Add tracks" title is present on every screen of the modal (root
// search, library, playlist track list), so its absence is the only
// reliable "fully closed" signal.
function isAddTracksModalOpen() {
  return !!findByExactText("span", "Add tracks");
}

// The close button is icon-only (an X, no text content), so it has to be
// matched by its data-slot rather than by visible text.
function getModalCloseButton() {
  return document.querySelector('[data-slot="modal-close-trigger"]');
}

async function closeAddMusicModal({ attempts = 12, delay = 400 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (!isAddTracksModalOpen()) {
      log(`Modal closed (confirmed after ${i} attempt(s))`);
      return true;
    }
    const closeBtn = getModalCloseButton();
    log(`Close attempt ${i + 1}/${attempts}`, closeBtn);
    if (closeBtn) {
      simulateClick(closeBtn);
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    }
    await sleep(delay);
  }
  const stillOpen = isAddTracksModalOpen();
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
    throw new Error('Could not find an "Add music" button on this page');
  }
  simulateClick(addButton);

  await waitFor(() => getLibraryButton());
  await sleep(300);

  notify("Opening Spotify library...");
  const libraryButton = getLibraryButton();
  if (!libraryButton) {
    throw new Error('Could not find the "My Spotify Library" option');
  }
  simulateClick(libraryButton);

  notify(`Looking for playlist "${playlistName}"...`);
  await waitFor(() => findByExactText("h4", "Playlists"), { timeout: 5000 });
  const row = await findPlaylistRowWithScroll(playlistName);
  if (!row) {
    await closeAddMusicModal();
    throw new Error(`Playlist "${playlistName}" not found in your saved playlists`);
  }
  log("Found playlist row, clicking it", row);
  simulateClick(row);

  notify("Opening playlist...");
  await waitFor(() => findButtonByText("Add all"), { timeout: 5000 });
  // The button renders before the track list data behind it has finished
  // loading - give it a moment to settle before clicking.
  await sleep(900);

  const addAllBtn = findButtonByText("Add all");
  if (!addAllBtn) {
    throw new Error('"Add all" button disappeared before it could be clicked');
  }
  log("Clicking Add all", addAllBtn);
  simulateClick(addAllBtn);

  notify("Waiting for songs to be added...");
  const confirmation = await waitForAddConfirmation(startCount);

  const closed = await closeAddMusicModal();
  log("closeAddMusicModal result:", closed);

  if (!confirmation) {
    throw new Error(
      `Clicked "Add all" but never saw confirmation (was ${startCount ?? 0} songs). It may still be loading - check the page directly.`
    );
  }

  notify(
    `Done (${confirmation.source}) - queue now has ${confirmation.count} songs${closed ? "" : " (modal still open)"}`
  );
}
