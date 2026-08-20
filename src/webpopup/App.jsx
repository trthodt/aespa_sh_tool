import React, { useEffect, useState } from "react";
import { getQueueState, subscribe } from "../content/queueStore";
import { triggerAddPlaylist, subscribeStatus } from "../content/autoAdd";

const DEFAULT_THRESHOLD = 10;

export default function App() {
  const [{ count }, setQueue] = useState(getQueueState());
  const [playlistName, setPlaylistName] = useState("");
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState("queue");
  const [minimized, setMinimized] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => subscribe(setQueue), []);
  useEffect(() => subscribeStatus(setStatus), []);

  useEffect(() => {
    chrome.storage.local
      .get([
        "sthPlaylistName",
        "sthAutoAddThreshold",
        "sthAutoAddEnabled",
        "sthPopupMinimized",
        "sthPopupHidden",
      ])
      .then((s) => {
        if (s.sthPlaylistName) setPlaylistName(s.sthPlaylistName);
        if (s.sthAutoAddThreshold) setThreshold(s.sthAutoAddThreshold);
        setAutoEnabled(s.sthAutoAddEnabled !== false);
        setMinimized(!!s.sthPopupMinimized);
        setHidden(!!s.sthPopupHidden);
      });

    const onChanged = (changes, area) => {
      if (area !== "local") return;
      if (changes.sthPopupHidden) setHidden(!!changes.sthPopupHidden.newValue);
      if (changes.sthPopupMinimized) setMinimized(!!changes.sthPopupMinimized.newValue);
      if (changes.sthAutoAddEnabled) setAutoEnabled(changes.sthAutoAddEnabled.newValue !== false);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  const savePlaylistName = (value) => {
    setPlaylistName(value);
    chrome.storage.local.set({ sthPlaylistName: value });
  };

  const saveThreshold = (value) => {
    const n = Math.max(1, parseInt(value, 10) || DEFAULT_THRESHOLD);
    setThreshold(n);
    chrome.storage.local.set({ sthAutoAddThreshold: n });
  };

  const toggleAutoEnabled = () => {
    const next = !autoEnabled;
    setAutoEnabled(next);
    chrome.storage.local.set({ sthAutoAddEnabled: next });
  };

  const setMinimizedPersist = (value) => {
    setMinimized(value);
    chrome.storage.local.set({ sthPopupMinimized: value });
  };

  const setHiddenPersist = (value) => {
    setHidden(value);
    chrome.storage.local.set({ sthPopupHidden: value });
  };

  if (hidden) return null;

  const isRunning = status?.state === "running";

  if (minimized) {
    return (
      <button
        onClick={() => setMinimizedPersist(false)}
        title="Expand Stationhead Queue"
        className="fixed top-[102px] right-4 z-[9999] bg-white shadow-lg rounded-full w-11 h-11 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-800"
      >
        {count ?? "-"}
      </button>
    );
  }

  return (
    <div className="fixed top-[102px] right-4 bg-white shadow-lg rounded-xl p-3 z-[9999] w-72 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">Stationhead Queue</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAutoEnabled}
            title={autoEnabled ? "Auto-add is ON - click to pause" : "Auto-add is OFF - click to enable"}
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
              autoEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            AUTO
          </button>
          <button
            onClick={() => setMinimizedPersist(true)}
            title="Minimize"
            className="text-gray-400 hover:text-gray-700 leading-none text-base"
          >
            &#8211;
          </button>
          <button
            onClick={() => setHiddenPersist(true)}
            title="Hide"
            className="text-gray-400 hover:text-gray-700 leading-none text-base"
          >
            &#10005;
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-3 border-b border-gray-200">
        <button
          onClick={() => setTab("queue")}
          className={`text-xs pb-1.5 ${
            tab === "queue" ? "border-b-2 border-purple-600 text-purple-600 font-medium" : "text-gray-500"
          }`}
        >
          Queue
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`text-xs pb-1.5 ${
            tab === "settings" ? "border-b-2 border-purple-600 text-purple-600 font-medium" : "text-gray-500"
          }`}
        >
          Settings
        </button>
      </div>

      {tab === "queue" && (
        <div>
          <p className="text-sm text-gray-700">
            {count === null ? "Queue not found on this page" : `\u{1F3B5} ${count} song${count === 1 ? "" : "s"} left`}
          </p>
          <p className="text-xs text-gray-400">Auto-add: {autoEnabled ? "On" : "Off"}</p>
          <button
            onClick={() => triggerAddPlaylist(playlistName)}
            disabled={isRunning}
            className="mt-2 w-full text-sm bg-purple-600 text-white rounded py-1 disabled:opacity-50"
          >
            {isRunning ? "Adding..." : "Add playlist now"}
          </button>
          {status && (
            <p
              className={`text-xs mt-1 ${
                status.state === "error" ? "text-red-500" : isRunning ? "text-gray-500" : "text-green-600"
              }`}
            >
              {status.message}
            </p>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div>
          <label className="text-xs font-medium text-gray-600">Playlist keyword</label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => savePlaylistName(e.target.value)}
            placeholder="e.g. [STREAM_aespa]"
            className="mt-1 w-full text-sm border border-gray-300 bg-white rounded px-2 py-1 text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">
            Matches any of your saved playlists whose name contains this text. Leave empty to use your first saved
            playlist.
          </p>

          <label className="text-xs font-medium text-gray-600 mt-3 block">Auto-add when queue drops to</label>
          <input
            type="number"
            min={1}
            value={threshold}
            onChange={(e) => saveThreshold(e.target.value)}
            className="mt-1 w-full text-sm border border-gray-300 bg-white rounded px-2 py-1 text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">songs remaining</p>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs font-medium text-gray-600">Auto-add enabled</span>
            <button
              onClick={toggleAutoEnabled}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                autoEnabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"
              }`}
            >
              {autoEnabled ? "On" : "Off"}
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center">Made by TruongTho</p>
        </div>
      )}
    </div>
  );
}
