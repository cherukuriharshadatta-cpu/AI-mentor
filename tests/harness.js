// Shared fake-browser for testing bob.js in Node (no real browser needed).
const fs = require("fs"), path = require("path");
const BASE = fs.existsSync(path.join(__dirname, "bob.js")) ? __dirname : path.join(__dirname, "..");

module.exports = function setup({ stored = {}, page = {}, prefs = {}, config = {} } = {}) {
  const mkEl = () => {
    const el = { style: {}, dataset: {}, children: [], className: "", _html: "", value: "", scrollTop: 0, parentNode: { scrollTop: 0, scrollHeight: 500, clientHeight: 500 },
      classList: { _s: new Set(), toggle(c, on) { on === false || (on === undefined && this._s.has(c)) ? this._s.delete(c) : this._s.add(c); }, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); } },
      appendChild(c) { this.children.push(c); }, setAttribute() {}, addEventListener(t, f) { (this.h = this.h || {})[t] = f; },
      querySelector() { return this._q || (this._q = { innerHTML: "" }); }, setPointerCapture() {}, focus() {}, remove() {}, select() {} };
    Object.defineProperty(el, "innerHTML", { get() { return this._html; }, set(v) { this._html = v; if (v === "") this.children = []; } });
    return el;
  };
  const els = {};
  const shadow = { handlers: {}, innerHTML: "", getElementById: (id) => els[id] || (els[id] = mkEl()), addEventListener(t, f) { this.handlers[t] = f; } };
  const hostEl = mkEl(); hostEl.attachShadow = () => shadow;
  let first = true;
  const PAGE = Object.assign({ user: [], asst: [], pre: [], text: "" }, page);
  const main = {
    querySelector() { return PAGE.streaming ? {} : null; },
    querySelectorAll(sel) {
      if (sel === "pre") return PAGE.pre.map((t) => ({ textContent: t }));
      if (sel === '[data-message-author-role="user"]') return PAGE.user.map((t) => ({ textContent: t }));
      if (sel === '[data-message-author-role="assistant"]') return PAGE.asst.map((t) => ({ textContent: t }));
      return [];
    },
    get textContent() { return PAGE.text; }, innerText: "Page text about loops",
  };
  const st = JSON.parse(JSON.stringify(stored));
  const pf = Object.assign({ key: "", level: "unknown", model: "auto" }, prefs);
  const calls = [];
  const g = global;
  g.window = g; g.BobConfig = config;
  for (const file of ['privacy','conversation','project-model','readiness-planner','requirements','verification','project-store','model-reasoner']) require(path.join(BASE,file+'.js'));
  g.BobEngine = require(path.join(BASE, "engine.js"));
  g.location = { origin: "https://chat.test", pathname: "/c/1", hostname: "chat.test" };
  g.innerWidth = 1200; g.innerHeight = 800; g.addEventListener = () => {};
  g.document = { createElement: () => { if (first) { first = false; return hostEl; } return mkEl(); }, body: { appendChild() {}, innerText: "" }, querySelector: (s) => (s === "main" ? main : null) };
  g.chrome = { storage: { local: {
    get: async () => JSON.parse(JSON.stringify(st)),
    set: async (o) => { Object.assign(st, o); },
    remove: async (k) => { for(const key of Array.isArray(k)?k:[k])delete st[key]; } } } };
  g.__stale = false;
  g.document.documentElement = { style: {} };
  g.BobBridge = {
    alive: () => !g.__stale,
    loadPrefs: async () => ({ ...pf }),
    savePref: (k, v) => { pf[k] = v; },
    clearPrefs: async () => { for (const k of Object.keys(pf)) delete pf[k]; },
    stream: (args) => {
      calls.push(args);
      if (g.__stale) return (async function* () { throw Object.assign(new Error("Bob was just updated, so this tab is out of date. Please refresh the page (F5) and try again."), { fatal: true }); })();
      return (async function* () { yield "Hi <think>secret thoughts</think>there, friend"; })();
    },
  };
  g.MutationObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} };
  g.getSelection = () => "";
  const ctx = { copied: null };
  Object.defineProperty(g, "navigator", { value: { clipboard: { writeText: async (t) => { ctx.copied = t; } } }, configurable: true, writable: true });
  require(path.join(BASE, "bob.js"));

  const $$ = (id) => shadow.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = async (act, extra = {}, key) => {
    const btn = { dataset: { act, ...extra }, closest: (s) => (s === "[data-key]" && key ? { dataset: { key } } : null), textContent: "" };
    await shadow.handlers.click({ target: { closest: (s) => (s === "[data-act]" ? btn : null) } });
  };
  let fails = 0, total = 0;
  const check = (name, cond) => { total++; console.log((cond ? "  ok  " : "FAIL  ") + name); if (!cond) fails++; };
  return Object.assign(ctx, {
    shadow, hostEl, $$, wait, click, check, PAGE, stored: st, prefs: pf, calls,
    msgsHtml: () => $$("msgs").children.map((c) => c._html + (c._q ? c._q.innerHTML : "")).join("\n"),
    rescan: async () => { await click("pause"); await click("resume"); await wait(700); },   // stands in for "the page changed"
    ensureList: async () => { if (!/Hide the full list/.test($$("body").innerHTML)) await click("showlist"); },
    finish: () => { console.log(fails ? `\n${fails} FAILED` : `\nALL ${total} CHECKS PASSED`); process.exit(fails ? 1 : 0); },
  });
};
