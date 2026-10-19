// Tests the REAL bridge.js, including the exact situation from the bug report:
// a tab left open after the extension was updated, where chrome.runtime is gone.
const fs = require("fs"), path = require("path"), assert = require("assert");
const BASE = fs.existsSync(path.join(__dirname, "bridge.js")) ? __dirname : path.join(__dirname, "..");
global.window = global;
global.chrome = {};   // chrome.runtime is undefined, like a tab left open across an extension update
require(path.join(BASE, "bridge.js"));
const B = global.BobBridge;
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log("  ok  " + name); } catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); } };
const drain = async (gen) => { const out = []; for await (const c of gen) out.push(c); return out; };

(async () => {
  console.log("Tab left open across an update (chrome.runtime is undefined)");
  await t("alive() is false, no crash", () => assert.strictEqual(B.alive(), false));
  await t("streaming gives a friendly 'refresh the page' error, not \"reading 'connect'\"", async () => {
    let err; try { await drain(B.stream({ models: ["m"], messages: [], key: "k" })); } catch (e) { err = e; }
    assert(err && /refresh the page/i.test(err.message) && err.fatal === true);
    assert(!/connect/.test(err.message));
  });
  await t("loading and saving settings quietly do nothing instead of throwing", async () => {
    assert.deepStrictEqual(await B.loadPrefs(), {});
    assert.strictEqual(await B.savePref("key", "x"), null);
    assert.strictEqual(await B.clearPrefs(), null);
  });
  await t("a connect() that throws is handled too", async () => {
    global.chrome = { runtime: { id: "abc", connect() { throw new Error("Extension context invalidated."); } } };
    let err; try { await drain(B.stream({ models: [], messages: [], key: "k" })); } catch (e) { err = e; }
    assert(err && /refresh the page/i.test(err.message));
  });

  console.log("Normal operation");
  const mkPort = (script) => {
    const p = { _m: null, _d: null, onMessage: { addListener(f) { p._m = f; } }, onDisconnect: { addListener(f) { p._d = f; } },
      postMessage(msg) { p.sent = msg; setTimeout(() => script.forEach((m) => p._m(m)), 5); }, disconnect() { p.closed = true; } };
    return p;
  };
  await t("chunks stream through in order and the port is closed", async () => {
    const port = mkPort([{ chunk: "Hel" }, { chunk: "lo" }, { done: true }]);
    global.chrome = { storage: { local: { get: async () => ({ key: "k" }), set: async () => {}, remove: async () => {} } }, runtime: { id: "abc", connect: () => port } };
    const out = await drain(B.stream({ models: ["m1"], messages: [{ role: "user", content: "hi" }], key: "sk" }));
    assert.deepStrictEqual(out, ["Hel", "lo"]);
    assert.deepStrictEqual(port.sent.models, ["m1"]);
    assert(port.closed);
  });
  await t("an error from the background reaches the chat with its message", async () => {
    const port = mkPort([{ error: { message: "OpenRouter rejected the key.", fatal: true } }]);
    global.chrome = { runtime: { id: "abc", connect: () => port } };
    let err; try { await drain(B.stream({ models: [], messages: [], key: "k" })); } catch (e) { err = e; }
    assert(err && /rejected the key/.test(err.message) && err.fatal === true);
  });
  await t("settings load and save when the extension is alive", async () => {
    let saved = null;
    global.chrome = { runtime: { id: "abc" }, storage: { local: { get: async () => ({ key: "k", w: "420" }), set: async (o) => { saved = o; }, remove: async () => {} } } };
    assert.deepStrictEqual(await B.loadPrefs(), { key: "k", w: "420" });
    await B.savePref("w", "500"); assert.deepStrictEqual(saved, { w: "500" });
  });
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
