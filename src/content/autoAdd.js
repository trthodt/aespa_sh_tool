import { addPlaylistToQueue } from "./addPlaylist";

const AUTO_ADD_THRESHOLD = 10;

let running = false;
let armed = true;
const listeners = new Set();

function notify(status) {
  listeners.forEach((fn) => fn(status));
}

export function subscribeStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function triggerAddPlaylist(playlistName) {
  if (running) return;
  running = true;
  notify({ state: "running", message: "Starting..." });
  try {
    await addPlaylistToQueue(playlistName, {
      onStatus: (message) => notify({ state: "running", message }),
    });
    notify({ state: "done", message: "Playlist added to queue" });
  } catch (err) {
    notify({ state: "error", message: err.message });
  } finally {
    running = false;
  }
}

// Fires once per dip below the threshold; re-arms once the queue climbs
// back above it, so a small playlist can't retrigger in a tight loop.
export function maybeAutoTrigger(count, playlistName, threshold = AUTO_ADD_THRESHOLD, enabled = true) {
  if (!enabled || count === null) return;

  if (count > threshold) {
    armed = true;
    return;
  }

  if (!armed || running || !playlistName?.trim()) return;

  armed = false;
  triggerAddPlaylist(playlistName);
}
