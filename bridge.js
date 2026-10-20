// Saves Bob's settings inside the extension (not in the chat site's storage) and
// talks to OpenRouter through background.js (so the chat site's rules can't block it).
(function () {
  const STALE = "Bob was just updated, so this tab is out of date. Please refresh the page (F5) and try again.";
  // After the extension is reloaded or updated, tabs that were already open lose their
  // connection (chrome.runtime disappears). Detect that instead of crashing.
  const alive = () => { try { return !!(chrome && chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  const safe = (fn, fallback) => async (...a) => { try { return alive() ? await fn(...a) : fallback; } catch (e) { return fallback; } };
  const staleStream = () => (async function* () { throw Object.assign(new Error(STALE), { fatal: true }); })();
  const PREF_KEYS = ["key", "level", "model", "pos", "w", "h", "push", "customModel"];

  window.BobBridge = {
    alive,
    loadPrefs: safe(() => chrome.storage.local.get(PREF_KEYS), {}),
    savePref: safe((k, v) => chrome.storage.local.set({ [k]: v }), null),
    clearPrefs: safe(() => chrome.storage.local.remove(PREF_KEYS), null),
    stream: function ({ models, messages, key, responseFormat, signal }) {
      if (!alive()) return staleStream();
      let port;
      try { port = chrome.runtime.connect({ name: "bob" }); } catch (e) { return staleStream(); }
      const queue = [];
      let wake = null, finished = false, error = null;
      const abort = () => { error = { message: "Request cancelled." }; finished = true; try { port.disconnect(); } catch {} poke(); };
      const deadline = setTimeout(abort, 150000);
      if (signal) signal.addEventListener("abort", abort, { once: true });
      const poke = () => { if (wake) { wake(); wake = null; } };
      port.onMessage.addListener((m) => {
        if (m.chunk) queue.push(m.chunk);
        else if (m.error) { error = m.error; finished = true; }
        else if (m.done) finished = true;
        poke();
      });
      port.onDisconnect.addListener(() => { if (!finished) error = { message: "Connection closed before the answer finished. Please retry." }; finished = true; poke(); });
      try { port.postMessage({ models, messages, key, responseFormat }); } catch (e) { return staleStream(); }
      return (async function* () {
        try {
          while (true) {
            if (queue.length) { yield queue.shift(); continue; }
            if (finished) break;
            await new Promise((r) => (wake = r));
          }
          if (error) throw Object.assign(new Error(error.message), { fatal: error.fatal });
        } finally { clearTimeout(deadline); if (signal) signal.removeEventListener("abort", abort); try { port.disconnect(); } catch (e) {} }
      })();
    },
  };
})();
