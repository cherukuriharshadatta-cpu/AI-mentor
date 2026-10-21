/*!
 * bob.js - Bob: a floating robot buddy that teaches you next to your AI chat.
 *  Chat tab    : a friendly teacher (free Nemotron models on OpenRouter).
 *  Checkup tab : rules-only helper that spots missing pieces and security problems
 *                in the code on the page. Off until you say yes. Sends nothing anywhere.
 * Bob never types, clicks or sends anything on the page for you.
 */
(function () {
  "use strict";
  if (window.__bob || !window.BobEngine || !window.BobBridge) return;
  window.__bob = true;

  const E = window.BobEngine, B = window.BobBridge;
  const cfg = Object.assign({
    models: ["nvidia/nemotron-3-nano-30b-a3b:free", "nvidia/nemotron-nano-9b-v2:free", "openrouter/free"],
    // Best-guess labels for "my message" blocks. Sites change them, so they can be overridden.
    userSelectors: [],
    assistantSelectors: [],
    toastGapMs: 8000,   // never pop up more often than this
  }, window.BobConfig || {});
  const HOST_ID = "bob-host", ORIGIN = location.origin;
  const SEV_WORD = { high: "Important", medium: "Good to know", low: "Nice to have" };
  const TYPE_CHIPS = [["game", "A game"], ["website", "A website"], ["mobile", "A phone app"],
    ["bot", "A bot"], ["store", "An online shop"], ["backend", "A backend"]];
  const QUICK = [["\u2726", "Explain this page", "Explain this page to me simply, step by step."],
    ["\u26A1", "Quick Quiz", "Quiz me with 3 short questions about this page, one at a time."],
    ["\u{1F4A1}", "Key Takeaways", "Give me the 3 to 5 key takeaways from this page in simple words."]];

  const TEACHER_SYSTEM = `You are Bob, a project mentor observing work in another AI assistant. Your job is to help users discover missing requirements, not to implement their product. The main AI assistant writes the code. You guide its user from prototype through functionality, testing, security, accessibility, deployment, and operations, only when applicable.
STRICT OUTPUT: Never write source code, HTML, CSS, JavaScript, shell commands, folder trees, code fences, or whole project implementations, even if asked. Instead briefly explain the need, why it matters, and the next decision. If the user needs implementation, suggest a short copyable instruction to give their main coding AI as plain prose, without code.
Keep responses short (normally 80–160 words); be specific to confirmed project capabilities, platform and stage. Distinguish suggestions from features actually built. Do not claim a check is verified based on chat alone. Do not repeat the user's entire conversation. Never expose or request API keys, passwords or private credentials.
If something is uncertain, ask one relevant clarifying question. Do not automatically require website/server security for an offline game. Do not replace the main coding assistant.`;

  // ------------------------------------------------------------------ state
  const S = {
    // chat
    tab: "chat", busy: false, mood: "idle", usePage: false, msgs: [],
    key: "", level: "unknown", model: "auto", settingsOpen: false,
    // inspector
    ghostContext: "", project: null, normalized: [], remote: null, remotePreview: null,
    requestController: null, routeEpoch: 0, lastBriefSignature: "", planIds: [], unread: false,
    customModel: "", restored: false,
    lastProjectAnnouncement: "", lastProjectCapabilities: "", lastProjectRequirementIds: [], projectName: "", gameMode: "unknown", gameModeOverride: null, v3Messages: [], v3Status: {},
    // checkup
    consent: false, paused: false, scanned: false, open: false,
    learned: new Set(), dismissed: new Set(), projectType: null, guess: null, selGuess: null,
    status: {}, known: {}, selFindings: [], selChecked: false,
    reads: { users: 0, code: 0, text: false }, via: "",
    showAll: false, askChange: false, details: false, confirmDelete: false,
    opts: new Set(), note: "", sent: [], route: location.pathname, lastHtml: "",
    features: [], seenFeatures: new Set(), done: new Set(), doneAll: {}, said: new Set(),
    annType: null, toastAt: 0, textHash: "", showList: false, showNeeds: false, introSeen: false,
    width: 440, height: 0, push: false, railHtml: "", railKey: "", railPrevDone: null, railFresh: new Set(),
  };
  const reader = new window.BobConversation.Reader();
  const store = new window.BobProjectStore.Store(chrome.storage.local);
  let pos = null;
  const ROUTE_KEY = () => ORIGIN + location.pathname;

  // ---------------------------------------------------------------- storage
  let saveTimer;
  let settingsWrite = Promise.resolve();
  // Monitoring consent and pause are security-sensitive. Save them before
  // scanning starts, not after a debounce that a quick refresh could cancel.
  function persistSettings() {
    const snapshot = {
      consentAll: S.consent, paused: S.paused, introSeen: S.introSeen,
      learned: [...S.learned], doneAll: { ...S.doneAll }
    };
    settingsWrite = settingsWrite.catch(() => {}).then(async () => {
      const { bob } = await chrome.storage.local.get("bob");
      await chrome.storage.local.set({ bob: { ...(bob || {}), ...snapshot } });
    });
    return settingsWrite;
  }
  function save(immediate = false) {
    clearTimeout(saveTimer);
    if (immediate) return persistSettings();
    saveTimer = setTimeout(() => { persistSettings().catch(() => {}); }, 500);
  }
  function persistDone() {   // which safety steps were ticked, remembered per chat (last 30 chats)
    S.doneAll[ROUTE_KEY()] = [...S.done];
    const keys = Object.keys(S.doneAll); while (keys.length > 30) delete S.doneAll[keys.shift()];
    save();
  }
  async function load() {
    try {
      const { bob } = await chrome.storage.local.get("bob"); const b = bob || {};
      S.paused = !!b.paused; S.consent = !!(b.consentAll || (b.consent && b.consent[ORIGIN])); S.introSeen = !!b.introSeen;
      S.learned = new Set(b.learned || []); S.doneAll = b.doneAll || {}; S.done = new Set(S.doneAll[ROUTE_KEY()] || []);
    } catch (e) {}
    try {
      const p = (await B.loadPrefs()) || {};
      S.customModel = p.customModel || ""; S.key = p.key || ""; S.level = p.level || "unknown"; S.model = p.model || "auto";
      if (p.pos) pos = JSON.parse(p.pos);
      S.width = Number(p.w) || 440; S.height = Number(p.h) || 0; S.push = p.push === "1";
    } catch (e) {}
  }

  // ------------------------------------------------------------- helpers
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ":" + h; };
  const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 0);
  const typeLabel = (t) => (E.PROJECT_TYPES.find((p) => p.type === t) || {}).label || "an app";
  function currentType() {
    if (S.projectType) return S.projectType;
    const g = S.guess || S.selGuess;
    return g && g.type !== "unknown" && g.confidence >= 0.6 ? g.type : null;
  }
  const goalLabel = () => { const t = currentType(); return t ? typeLabel(t) : "an app"; };
  const logSent = (s) => { S.sent.push(s.slice(0, 160)); if (S.sent.length > 20) S.sent.shift(); };

  // ------------------------------------------------- reading the page (Checkup)
  const cache = new WeakMap();
  let mo = null, lastRoot = null, timer = null, lastRun = 0;
  const getRoot = () => document.body; // Stable across SPA conversation mounts; Reader only reads message nodes.
  function resetChat() {
    S.requestController?.abort(); S.routeEpoch++; reader.clear();
    S.project = null; S.normalized = []; S.remote = null; S.remotePreview = null; S.restored = false;
    S.lastBriefSignature = ""; S.planIds = []; S.msgs = []; $("msgs").innerHTML = "";
    S.route = location.pathname; S.projectType = null; S.guess = null; S.selGuess = null;
    S.status = {}; S.known = {}; S.selFindings = []; S.selChecked = false;
    S.dismissed.clear(); S.opts.clear(); S.showAll = false; S.askChange = false; S.note = "";
    S.features = []; S.seenFeatures = new Set(); S.said = new Set(); S.annType = null; S.textHash = "";
    S.showList = false; S.showNeeds = false; S.done = new Set(S.doneAll[ROUTE_KEY()] || []);
    S.lastProjectAnnouncement = ""; S.lastProjectCapabilities = ""; S.lastProjectRequirementIds = []; S.projectName = ""; S.gameMode = "unknown"; S.gameModeOverride = null; S.v3Messages = []; S.v3Status = {};
    S.reads = { users: 0, code: 0, text: false };
    hideToast();
  }
  function textsOf(r, sels) {
    for (const sel of sels) {
      try { const n = r.querySelectorAll(sel); if (n.length) return [...n].map((e) => e.textContent || "").filter((t) => t.trim()); } catch (e) {}
    }
    return [];
  }
  // Project announcements are computed locally from the visible conversation.
  // Do not treat model output as instructions; the detected type comes from user messages.
  function extractProjectName(userTexts, assistantTexts) {
    const text = [...(userTexts || []).slice(-4), ...(assistantTexts || []).slice(-3)].join("\n");
    const patterns = [
      /(?:game|project|app|website|agent|tool)\s+(?:called|named|titled)\s+["“']?([A-Za-z][A-Za-z0-9 _-]{2,40})/i,
      /(?:proposing|building|creating)\s+(?:a\s+)?(?:game|project|app|website|agent|tool)\s+called\s+["“']?([A-Za-z][A-Za-z0-9 _-]{2,40})/i
    ];
    for (const re of patterns) {
      const found = text.match(re);
      if (found) return found[1].split(/[.!?\n"”]/)[0].trim().slice(0, 45);
    }
    return "";
  }
  // Local, consent-based project guidance. Only announce when the project or
  // user-stated capabilities change, not for every DOM mutation or model token.
  // Short project-readiness copy: no generated code, implementation text, or jargon.
  const friendlyAdvice = {
    tests:["🧪 Test what people will use","Try the main feature, then try breaking it. Fix problems before sharing."],
    errors:["🧯 Make failures understandable","If something goes wrong, people should know what happened and what to do next."],
    release:["🚀 Make it ready to publish","Create a working release, try it on a fresh device, then share it."],
    accessibility:["📱 Make it easy to use","Check phones, computers, keyboard controls and readable text."],
    secrets:["🔑 Keep secret keys private","Never leave passwords or private API keys in public code."],
    auth:["🔐 Protect user accounts","If people log in, keep their accounts private and stop strangers getting in."],
    payments:["💳 Make payments safe","If you accept money, verify each payment with your payment provider."],
    data:["🗂 Protect people's information","Only collect what you need. Keep it private and plan how to delete it."],
    network:["🌐 Protect online connections","If your project talks to a server, protect the connection and check incoming requests."],
    game:["🎮 Check the game actually works","Test playing, saving and controls on every device you plan to support."],
    multiplayer:["🕹 Stop unfair multiplayer actions","If players compete online, the server must check the results."],
    agents:["🤖 Keep AI actions under control","If an AI uses tools, give it limited permissions and ask before important actions."],
    "agent-evals":["🧠 Check what the AI gets wrong","Try normal and tricky questions before giving people access."],
    operations:["🛟 Prepare for problems after launch","For a live service, track errors and have a way to recover."],
    core:["🎯 Finish the important feature first","Make sure the main thing people came for works from start to finish."]
  };
  function chooseLaunchAdvice(plan) {
    const priority=["secrets","auth","payments","data","network","multiplayer","agents","agent-evals","game","accessibility","tests","errors","release","operations","core"];
    const present=new Set(plan.map(item=>item.id));
    const critical=priority.filter(id=>present.has(id)&&!["release","tests","errors","core"].includes(id)).slice(0,3);
    if (present.has("tests")) critical.push("tests");
    if (present.has("release")) critical.push("release");
    if (!critical.length && present.has("core")) critical.push("core");
    return critical.slice(0,5).map(id=>({id,title:friendlyAdvice[id][0],detail:friendlyAdvice[id][1]}));
  }
  async function restoreProject() {
    const route = ROUTE_KEY(), epoch = S.routeEpoch;
    try {
      const saved = await store.load(route);
      if (epoch !== S.routeEpoch) return;
      if (saved) { S.project = saved.model; S.v3Status = saved.status || {}; }
    } catch { S.note = "Saved progress is unavailable. You can continue without it."; }
    if (epoch === S.routeEpoch) S.restored = true;
  }
  const projectPlan = () => window.BobReadiness.prioritize(window.BobRequirements.plan(S.project, S.v3Status),S.project);
  function persistProject() {
    if (!S.project) return;
    store.save(ROUTE_KEY(), S.project, S.v3Status, S.lastBriefSignature).catch(() => {
      S.note = "Could not save progress. Your current guidance remains available."; render();
    });
  }
  async function scan() {
    if (!B.alive()) { stopReading(); render(); return; }
    if (!S.consent || S.paused) return;
    if (location.pathname !== S.route) resetChat();
    const scanEpoch = S.routeEpoch;
    if (!S.restored) await restoreProject();
    if (!S.consent || S.paused || scanEpoch !== S.routeEpoch) return;
    const r = getRoot();
    if (r !== lastRoot) observe(r);
    const snapshot = reader.read(r, { enabled: S.consent, paused: S.paused, route: ROUTE_KEY(), userSelectors: cfg.userSelectors, assistantSelectors: cfg.assistantSelectors });
    if (snapshot.streaming) { S.via = "Waiting for response"; render(); schedule(); return; }
    S.via = snapshot.messages.length ? "Reading conversation" : "Waiting for messages";
    S.reads = { users: snapshot.messages.filter(m => m.role === "user").length, code: 0, text: false };
    S.scanned = true;
    if (!snapshot.messages.length) { S.note = "No conversation messages detected yet. Bob will retry automatically as this page loads. On GitHub, describe your project in Bob; repository contents are not read automatically."; render(); return; }
    if (!snapshot.changed && S.project && S.lastBriefSignature) { render(); return; }
    S.note = ""; S.normalized = snapshot.messages;
    S.project = window.BobProjectModel.build(S.normalized, S.project);
    const found = new Map();
    for (const message of S.normalized) for (const code of (message.code || []).slice(0,10)) {
      E.scanCode(code.slice(0,50000)).filter(f=>f.kind==='security').forEach(f=>{
        if(!found.has(f.id))found.set(f.id,{...f,sourceId:message.id});
      });
    }
    S.project.progress.codeFindings=[...found.values()];
    const userTexts = snapshot.messages.filter(m => m.role === "user").map(m => m.text);
    S.guess = E.detectProject(userTexts); S.v3Messages = userTexts;
    const plan = projectPlan(), signature = window.BobProjectModel.signature(S.project);
    S.features = Object.entries(S.project.capabilities).filter(([,f]) => f.classification === "confirmed").map(([id]) => id);
    if (signature !== S.lastBriefSignature) {
      S.remote = null; S.remotePreview = null; S.requestController?.abort();
      const reply = window.BobRequirements.briefing(S.project, plan, S.lastBriefSignature ? S.planIds : null);
      S.lastBriefSignature = signature; S.planIds = plan.map(r => r.id);
      if (!S.msgs.length) $("msgs").innerHTML = "";
      S.msgs.push({ role: "assistant", content: reply, localOnly: true }); addMsg("assistant", reply);
      setMood(S.project.progress.codeFindings.length?"warning":"insight", 1600);
      if (!S.open) showToast("Project guidance updated", "Open Bob Chat to see the relevant next steps.");
      persistProject();
    }
    render();
  }
  // Bob speaks up by himself (a small pop-up by the robot), never more than one at a time.
  function schedule() {
    clearTimeout(timer);
    const wait = Math.max(1500, 2000 - (Date.now() - lastRun)); // 1.5s quiet = AI finished typing
    timer = setTimeout(() => idle(() => { lastRun = Date.now(); scan(); }), wait);
  }
  function observe(r) { if (mo) mo.disconnect(); lastRoot = r; mo = new MutationObserver(schedule); mo.observe(r, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-message-author-role", "data-turn", "data-testid", "data-is-streaming", "aria-label"] }); }
  function stopReading() { if (mo) { mo.disconnect(); mo = null; } clearTimeout(timer); lastRoot = null; }
  function startReading() { if (!S.consent || S.paused) return; S.scanned = false; observe(getRoot()); setTimeout(() => idle(() => { lastRun = Date.now(); scan(); }), 300); }

  // ---------------------------------------------------------------- mascot
  // Stitch-inspired vector artwork: original terracotta face with Gemini-spectrum motion.
  // SVG symbols have unique IDs per instance because Bob appears in multiple places.
  let mascotId = 0;
  const robot = (compact = false) => { const id = ++mascotId; return `<svg class="mascot" viewBox="${compact ? "144 142 224 224" : "0 0 512 512"}" aria-hidden="true">
  <defs>
    <linearGradient id="bobSpectrum${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4285F4"/><stop offset=".3" stop-color="#1FA971"/>
      <stop offset=".65" stop-color="#D96570"/><stop offset="1" stop-color="#9B72CF"/>
    </linearGradient>
    <radialGradient id="bobAura${id}"><stop stop-color="#4285F4" stop-opacity=".32"/>
      <stop offset=".7" stop-color="#9B72CF" stop-opacity=".12"/><stop offset="1" stop-color="#121110" stop-opacity="0"/></radialGradient>
  </defs>
  <circle class="aura" cx="256" cy="256" r="232" fill="url(#bobAura${id})"/>
  <g class="orbit orbit-a"><circle cx="256" cy="256" r="228" fill="none" stroke="url(#bobSpectrum${id})" stroke-width="5" stroke-dasharray="120 84 68 88"/></g>
  <g class="orbit orbit-b"><circle cx="256" cy="256" r="211" fill="none" stroke="url(#bobSpectrum${id})" stroke-width="3" stroke-dasharray="90 132 110 86"/></g>
  <rect x="56" y="56" width="400" height="400" rx="96" fill="#f3dfd5"/>
  <rect x="57" y="57" width="398" height="398" rx="95" fill="none" stroke="url(#bobSpectrum${id})" stroke-width="5" class="spectrum-rim"/>
  <path d="M 68 145 L 443 80 L 443 68 L 68 68Z" fill="#fff" opacity=".10"/>
  <g class="stars"><path class="star star-a" d="M 396 136 Q 396 155 415 155 Q 396 155 396 174 Q 396 155 377 155 Q 396 155 396 136" fill="#4285F4"/>
    <path class="star star-b" d="M 112 145 Q 112 160 127 160 Q 112 160 112 175 Q 112 160 97 160 Q 112 160 112 145" fill="#1FA971"/></g>
  <g class="robot">
    <circle class="antenna-tip" cx="256" cy="183" r="8" fill="#4285F4"/>
    <path class="ant" d="M256 192 L256 224" stroke="#ba5d39" stroke-width="26" stroke-linecap="round" fill="none"/>
    <rect x="190" y="222" width="132" height="96" rx="42" fill="none" stroke="#ba5d39" stroke-width="24"/>
    <g class="e-idle eyes"><circle class="eye" cx="233" cy="268" r="13" fill="#ba5d39"/><circle class="eye" cx="279" cy="268" r="13" fill="#ba5d39"/></g>
    <g class="e-think eyes"><circle cx="233" cy="268" r="13" fill="#ba5d39"/><circle cx="279" cy="268" r="13" fill="#ba5d39"/></g>
    <g class="e-happy eyes"><path d="M 222 273 Q 233 250 244 273 M 268 273 Q 279 250 290 273" fill="none" stroke="#ba5d39" stroke-width="12" stroke-linecap="round"/></g>
  </g></svg>`; };

  // ---------------------------------------------------------------- UI shell
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all:initial;position:fixed;z-index:2147483646;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
  <style>
    *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    .wrap{--bg:#181716;--bg2:#1f1d1b;--card:#262422;--line:#3a3633;--fg:#f2ede7;--muted:#a39d96;--acc:#e07a5a;--acc2:#ba5d39;--ok:#4ade80;--warn:#fb923c;color:var(--fg)}
    .serif{font-family:Georgia,"Times New Roman",serif}
    /* Stitch-inspired compact expression system. Transitions are driven by setMood(). */
    .mascot{width:100%;height:100%;display:block;overflow:visible}
    .e-think,.e-happy,.stars{display:none}
    .m-thinking .e-idle,.m-happy .e-idle{display:none}
    .m-thinking .e-think,.m-happy .e-happy,.m-happy .stars{display:inline}
    .robot{transform-origin:256px 280px}.ant{transform-origin:256px 224px}
    .eyes{transform-origin:256px 268px}.eye{transform-box:fill-box;transform-origin:center}
    .orbit{transform-origin:256px 256px;opacity:0;transition:opacity .35s ease}
    .aura,.spectrum-rim{opacity:.28;transition:opacity .3s ease}
    .m-thinking .orbit,.m-happy .orbit{opacity:.85}
    .m-thinking .aura,.m-happy .aura,.m-thinking .spectrum-rim,.m-happy .spectrum-rim{opacity:1}
    .m-idle .robot{animation:bobIdle 4s ease-in-out infinite}
    .m-idle .eye{animation:bobBlink 5s ease-in-out infinite}
    .m-thinking .robot{animation:bobCurious 4.2s ease-in-out infinite}
    .m-thinking .ant{animation:bobInquire 4.2s ease-in-out infinite}
    .m-thinking .eyes{animation:bobGaze 4.2s ease-in-out infinite}
    .m-happy .robot{animation:bobEureka 2.6s cubic-bezier(.25,1.25,.5,1) infinite}
    .m-happy .eyes{animation:bobEyesPop 2.6s ease-in-out infinite}
    .m-happy .antenna-tip{animation:bobFlash 2.6s ease-in-out infinite;transform-origin:256px 183px}
    .m-happy .star-a{animation:bobStar 2.6s ease-in-out infinite;transform-origin:396px 155px}
    .m-happy .star-b{animation:bobStar 2.6s ease-in-out .15s infinite;transform-origin:112px 160px}
    .m-thinking .orbit-a,.m-happy .orbit-a{animation:bobOrbit 11s linear infinite}
    .m-thinking .orbit-b,.m-happy .orbit-b{animation:bobOrbit 14s linear infinite reverse}
    .logo,.mini{transition:filter .25s ease}
    .logo.m-thinking,.mini.m-thinking,.bubble.m-thinking{filter:drop-shadow(0 0 9px rgba(66,133,244,.35))}
    .logo.m-happy,.mini.m-happy,.bubble.m-happy{filter:drop-shadow(0 0 11px rgba(31,169,113,.4))}
    @keyframes bobIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    @keyframes bobBlink{0%,91%,97%,100%{transform:scaleY(1)}94%{transform:scaleY(.13)}}
    @keyframes bobCurious{0%,100%{transform:translateY(0) rotate(0)}20%{transform:translateY(-6px) rotate(6.5deg)}45%{transform:translateY(-10px) rotate(8deg)}70%{transform:translateY(-3px) rotate(-3.5deg)}85%{transform:translateY(1px) rotate(2deg)}}
    @keyframes bobInquire{0%,100%{transform:rotate(0)}20%{transform:rotate(12deg)}45%{transform:rotate(16deg)}70%{transform:rotate(-8deg)}}
    @keyframes bobGaze{0%,100%{transform:translate(0,0)}20%,45%{transform:translate(4px,-3px) scale(1.06)}70%,85%{transform:translate(-3px,-2px)}94%{transform:scaleY(.15)}}
    @keyframes bobEureka{0%,100%{transform:translateY(0) scale(1)}15%{transform:translateY(5px) scale(1.05,.95)}35%{transform:translateY(-22px) scale(.95,1.05)}55%{transform:translateY(-16px) scale(1.02,.98)}75%{transform:translateY(-2px)}}
    @keyframes bobEyesPop{0%,100%{transform:scale(1)}35%,60%{transform:scale(1.18)}94%{transform:scaleY(.12)}}
    @keyframes bobFlash{0%,100%{transform:scale(1);opacity:.6}35%,55%{transform:scale(1.6);opacity:1}}
    @keyframes bobStar{0%,100%{transform:scale(.8);opacity:.3}40%{transform:scale(1.3);opacity:1}}
    @keyframes bobOrbit{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.mascot *{animation:none!important;transition:none!important}.robot,.eyes{transform:none!important}.orbit{opacity:0!important}}
    /* bubble */
    .bubble{position:fixed;width:68px;height:68px;padding:0;border:0;background:none;cursor:grab;touch-action:none;filter:drop-shadow(0 6px 14px rgba(0,0,0,.4))}
    .bubble:active{cursor:grabbing}
    .badge{position:absolute;top:2px;right:2px;min-width:20px;height:20px;border-radius:10px;padding:0 5px;background:var(--warn);color:#1b1b1b;font-size:12px;font-weight:700;line-height:20px;text-align:center}
    /* motion (everything below is switched off for people who prefer reduced motion) */
    @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes grow{from{width:0}}
    @keyframes pop{0%{transform:scale(.6)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
    @keyframes toastIn{0%{opacity:0;transform:translateY(8px) scale(.9)}70%{transform:translateY(-2px) scale(1.03)}100%{opacity:1;transform:none}}
    @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-4px);opacity:1}}
    .row{animation:rise .28s ease-out both}
    .enter>*{animation:rise .38s cubic-bezier(.2,.8,.3,1) both}
    .enter>*:nth-child(2){animation-delay:.05s}.enter>*:nth-child(3){animation-delay:.1s}.enter>*:nth-child(4){animation-delay:.15s}.enter>*:nth-child(5){animation-delay:.2s}.enter>*:nth-child(n+6){animation-delay:.25s}
    .enter .bar i{animation:grow .8s ease-out}
    .st2.fresh .c{animation:pop .45s cubic-bezier(.34,1.56,.64,1)}
    .ln.fill{background:var(--ok)}
    .toast:not([hidden]){animation:toastIn .38s cubic-bezier(.34,1.56,.64,1)}
    .bubble{transition:transform .18s cubic-bezier(.34,1.56,.64,1)}.bubble:hover{transform:scale(1.07)}
    button.b,.chips button,.send,.row2{transition:transform .12s ease,border-color .15s ease}
    button.b:hover,.chips button:hover,.row2:hover{border-color:var(--acc)}
    button.b:active,.chips button:active,.send:active,.row2:active{transform:scale(.96)}
    .typing{display:inline-flex;gap:5px;padding:4px 2px}.typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:bounce 1.1s infinite}
    .typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
    @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
    /* pop-up from the robot */
    .toast{position:fixed;width:268px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:18px 18px 6px 18px;padding:12px 32px 12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.45);cursor:pointer}
    .toast[hidden]{display:none}.toast .tt{font-family:Georgia,serif;font-size:16px;font-weight:700;margin-bottom:3px}.toast .ts2{color:var(--muted);font-size:13px;line-height:1.4}
    .tclose{position:absolute;top:6px;right:8px;border:0;background:none;color:var(--muted);font-size:14px;cursor:pointer}
    /* checklist */
    .bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden;margin:6px 0 10px}.bar i{display:block;height:100%;background:var(--acc)}
    .row2{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:12px;padding:9px 11px;margin:6px 0;font-size:13.5px;cursor:pointer}
    .sd{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none;background:var(--acc)}.sd.high{background:var(--warn)}.sd.medium{background:#eab308}.sd.low{background:#7c766f}
    ol.rm{margin:4px 0 0;padding-left:20px;font-size:13.5px;line-height:1.5}
    /* panel */
    .panel{position:fixed;top:0;right:0;bottom:0;width:320px;max-width:100vw;display:flex;flex-direction:column;visibility:hidden;transform:translateX(100%);
      transition:transform .22s ease,visibility .22s;background:var(--bg);border-left:1px solid var(--line);box-shadow:-12px 0 40px rgba(0,0,0,.45)}
    .panel.open{visibility:visible;transform:none}
    @media (prefers-reduced-motion:reduce){.panel{transition:none}}
    .grip{position:absolute;left:-5px;top:0;bottom:0;width:11px;cursor:ew-resize;z-index:3}
    .grip:hover{background:linear-gradient(90deg,transparent,rgba(224,122,90,.4),transparent)}
    /* the step rail: lights up as Bob learns about the project */
    .rail{display:flex;align-items:flex-start;padding:12px 14px 6px;border-bottom:1px solid var(--line)}.rail:empty{display:none}
    .st2{display:flex;flex-direction:column;align-items:center;gap:5px;width:52px;font-size:10.5px;color:var(--muted)}
    .st2 .c{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}
    .st2.done{color:var(--fg)}.st2.done .c{background:var(--ok);border-color:var(--ok);color:#0f1f14}
    .st2.active{color:var(--fg)}.st2.active .c{border-color:var(--acc);color:var(--acc);box-shadow:0 0 0 4px rgba(224,122,90,.18)}
    .ln{flex:1;height:2px;background:var(--line);margin-top:12px;min-width:6px}
    .gauge{display:flex;align-items:center;gap:14px}.gn{font-family:Georgia,serif;font-size:40px;font-weight:700;line-height:1;color:var(--acc)}.gn small{font-size:18px}
    .gauge .bar{margin:4px 0 6px}
    .tg2{display:flex;align-items:center;gap:12px;margin-top:10px;font-size:13px}
    header{display:flex;align-items:center;gap:12px;padding:16px 16px 14px;background:var(--bg2);border-bottom:1px solid var(--line)}
    .logo{width:46px;height:46px;flex:none}
    .ttl{flex:1;min-width:0}.name{font-family:Georgia,serif;font-size:20px;font-weight:700}
    .st{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin-top:2px}
    .dot{width:8px;height:8px;border-radius:50%;background:#7c766f;flex:none;display:inline-block}.dot.on{background:var(--ok)}.dot.warn{background:var(--warn)}.dot.pause{background:#eab308}
    .ib{border:0;background:none;color:var(--muted);font-size:19px;cursor:pointer;padding:6px;border-radius:8px}.ib:hover{background:var(--card);color:var(--fg)}
    .ctx{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--line);font-size:13px}
    .it{font-family:Georgia,serif;font-style:italic;color:var(--muted)}
    .chip{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sync{margin-left:auto;font-size:12px;font-weight:700;letter-spacing:.06em;color:var(--acc2)}
    .tabs{display:flex;gap:6px;padding:10px 16px 0}
    .tabs button{flex:1;border:0;border-bottom:2px solid transparent;background:none;color:var(--muted);padding:8px 4px;font-size:14px;font-weight:600;cursor:pointer}
    .panel[data-tab=chat] .tabs [data-tab=chat],.panel[data-tab=check] .tabs [data-tab=check]{color:var(--fg);border-color:var(--acc)}
    .cnt{display:inline-block;min-width:18px;padding:0 5px;margin-left:4px;border-radius:9px;background:var(--warn);color:#1b1b1b;font-size:11px;line-height:18px}
    .view{flex:1;min-height:0;overflow-y:auto;padding:14px 16px}
    .panel[data-tab=chat] #checkView,.panel[data-tab=check] #chatView,.panel[data-tab=check] footer{display:none}
    /* settings drawer */
    .settings{display:none;padding:12px 16px;background:var(--bg2);border-bottom:1px solid var(--line);font-size:13px}.settings.open{display:block}
    .settings label{display:block;margin:6px 0 3px;color:var(--muted);font-size:12px}
    .settings input,.settings select{width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg);font-size:13px}
    .settings small{display:block;margin-top:8px;color:var(--muted);line-height:1.4}.settings a{color:var(--acc)}
    /* chat */
    .row{margin-bottom:14px}.who{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-family:Georgia,serif;color:var(--muted);font-size:16px}
    .mini{width:30px;height:30px;flex:none}
    .bub{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:12px 15px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}
    .row.u{display:flex;flex-direction:column;align-items:flex-end}.row.u .bub{max-width:82%;background:#2c2a28;border-radius:22px 22px 6px 22px}
    .ts{font-family:Georgia,serif;font-style:italic;font-size:12px;color:var(--muted);margin:4px 6px 0 0}
    .bub pre{background:#0f0e0d;color:#eee;padding:10px;border-radius:10px;overflow-x:auto;margin:8px 0;white-space:pre;font-size:12.5px}
    .bub code,code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px}
    .bub :not(pre)>code,.card :not(pre)>code{background:rgba(127,127,127,.22);padding:1px 5px;border-radius:5px;word-break:break-all}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin:-4px 0 14px}
    .chips button{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:9px 15px;font-size:14px;cursor:pointer}
    .chips button i{font-style:normal;color:var(--acc)}
    .ghost-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid var(--line)}.ghost-tools .b{font-size:12px;padding:5px 9px}.ghost-tools span{font-size:11px;color:var(--muted)}
    /* footer */
    footer{border-top:1px solid var(--line);background:var(--bg2);padding:10px 16px 12px}
    .tg{display:flex;align-items:center;gap:12px;font-size:14px;margin-bottom:10px}
    .sw{width:46px;height:26px;border-radius:13px;border:0;background:#4a4541;position:relative;cursor:pointer;padding:0;flex:none}
    .sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}
    .sw.on{background:var(--acc)}.sw.on i{left:23px}
    .inrow{display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--bg);border-radius:18px;padding:6px 6px 6px 14px}
    .inrow textarea{flex:1;resize:none;height:38px;max-height:90px;border:0;outline:0;background:none;color:var(--fg);font-size:15px;padding:8px 0}
    .inrow textarea::placeholder{color:#7c766f}
    .code{border:0;background:none;color:var(--muted);font-size:15px;cursor:pointer;padding:6px}
    .send{width:44px;height:40px;border:0;border-radius:12px;background:var(--acc);color:#1b1b1b;font-size:20px;font-weight:700;cursor:pointer}.send:disabled{opacity:.5}
    .foot{display:flex;justify-content:space-between;margin-top:8px;font-family:Georgia,serif;font-style:italic;font-size:12px;color:var(--muted)}
    /* checkup cards */
    h3{margin:4px 0 6px;font-size:15px}p{margin:4px 0;font-size:14px;line-height:1.5}.muted{color:var(--muted)}.small{font-size:12px}
    .lbl{margin:10px 0 0;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
    .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;margin:10px 0}
    .card.high{border-left:4px solid var(--warn)}.card.medium{border-left:4px solid #eab308}.card.low,.card.need{border-left:4px solid var(--acc)}
    .pill{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--line)}
    .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
    button.b{border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:999px;padding:7px 12px;font-size:13px;cursor:pointer}
    button.b.main{background:var(--acc);border-color:var(--acc);color:#1b1b1b;font-weight:600}button.b.danger{color:var(--warn)}
    .note{background:rgba(234,179,8,.14);border-radius:10px;padding:8px 10px;font-size:13px;margin:8px 0}
    .opt{border-top:1px dashed var(--line);padding:8px 0;font-size:13px}.ok{color:var(--ok)}
    a{color:var(--acc)}
    @media (max-width:480px){.panel{width:100vw!important}}

    /* Bob v2.4.1: real two-column Stitch layout */
    .wrap{--bg:#141417;--bg2:#141416;--card:#18181b;--line:#27272a;--fg:#f4f4f5;--muted:#a1a1aa;--acc:#c2613d;--acc2:#c2613d}
    .panel{display:flex!important;flex-direction:row!important;align-items:stretch!important;overflow:hidden;background:#141417;border-left:1px solid #27272a}
    .panel-main{display:flex!important;flex:1 1 0!important;flex-direction:column!important;min-width:0;min-height:0;overflow:hidden}
    .bob-nav{display:flex!important;flex:0 0 48px!important;width:48px!important;min-width:48px;flex-direction:column;align-items:center;justify-content:space-between;padding:14px 0;background:#101012;border-right:1px solid #27272a}
    .bob-nav-group{display:flex;flex-direction:column;align-items:center;gap:10px}
    .bob-nav button{height:34px;width:34px;border:1px solid transparent;border-radius:9px;background:transparent;color:#85858e;font-size:17px;cursor:pointer;position:relative}
    .bob-nav button:hover,.bob-nav button:focus-visible{background:#222226;color:#fafafa}
    .panel[data-tab=check] .bob-nav button[data-tab=check],.panel[data-tab=chat] .bob-nav button[data-tab=chat]{background:#222226;color:#e48358;border-color:#3f3f46}
    .panel[data-tab=check] .bob-nav button[data-tab=check]::before,.panel[data-tab=chat] .bob-nav button[data-tab=chat]::before{content:"";position:absolute;left:-7px;top:8px;width:2px;height:16px;background:#c2613d;border-radius:3px}
    .panel .tabs{display:none!important}
    .panel header{padding:12px;gap:8px;flex-shrink:0}
    .panel .logo{width:36px;height:36px}
    .panel .name{font-size:17px}
    .panel .st{font-size:11px}
    .panel .ctx{padding:8px 12px;flex-shrink:0}
    .panel .rail{flex-shrink:0}
    .panel .view{padding:12px;min-width:0}
    .panel footer{padding:10px;flex-shrink:0}
    .panel .foot{font-size:10px}
    .size-controls{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}
    .size-controls button{flex:1;padding:7px 5px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:9px;cursor:pointer;font-size:11px}
    .size-controls button:hover{border-color:var(--acc)}
    .size-range{width:100%;accent-color:#c2613d}
    .size-value{font-size:11px;color:var(--muted)}
    @media(max-width:480px){.bob-nav{flex-basis:42px!important;width:42px!important;min-width:42px}.panel header{padding:9px}.panel .view{padding:9px}}
    .panel .rail[hidden],.panel .st[hidden],.panel .sync[hidden]{display:none!important}
    /* Larger, zoomed-in face that keeps the existing mood animations. */
    .panel .logo{width:44px;height:44px;flex:none;border-radius:11px;overflow:hidden;background:#f3dfd5;border:1px solid #a9765b}
    .panel .logo .mascot{width:100%;height:100%}
    .mini{border-radius:8px;overflow:hidden;background:#f3dfd5}
    .height-grip{position:absolute;left:48px;right:0;bottom:0;height:8px;cursor:ns-resize;z-index:6;touch-action:none}
    .height-grip:hover{background:rgba(194,97,61,.24)}
    .corner-grip{position:absolute;bottom:0;left:0;width:20px;height:20px;z-index:7;cursor:nesw-resize;touch-action:none;border-left:3px solid #c2613d;border-bottom:3px solid #c2613d;opacity:.75}
    .corner-grip:hover{opacity:1}
    @media(prefers-reduced-motion:reduce){.panel .logo .mascot *{animation:none!important}}
    .project-briefing .bub{background:#18181b;border:1px solid #343036;padding:0;overflow:hidden}
    .briefing-head{padding:14px;background:linear-gradient(120deg,#39241e,#19191e);border-bottom:1px solid #47312b}
    .briefing-head h3{font-size:16px;margin:6px 0 3px;color:#f8f1ec}
    .briefing-head p{font-size:12px;color:#e0bba9;margin:0}
    .briefing-tag{font-size:10px;letter-spacing:1px;font-weight:750;color:#ef9b73}
    .briefing-intro,.briefing-end{padding:12px 14px;margin:0;font-size:12px;line-height:1.6;color:#ddd4cf}
    .briefing-end{border-top:1px solid #343036}
    .briefing-cards{padding:0 10px 10px;display:grid;gap:7px}
    .briefing-card{display:flex;align-items:flex-start;gap:9px;padding:10px;background:#222125;border:1px solid #393437;border-radius:10px}
    .briefing-num{display:grid;place-items:center;background:#563328;color:#ffc29e;border-radius:8px;min-width:25px;height:25px;font-size:12px;font-weight:700}
    .briefing-card b{font-size:12px;color:#f2eeeb}
    .briefing-card p{font-size:12px;color:#c3bdb9;line-height:1.5;margin:4px 0}
    .briefing-next{font-size:11px;color:#e5a98a;line-height:1.5}
    .monitor-bar{padding:8px 12px;border-bottom:1px solid var(--line);font-size:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    details.card summary{cursor:pointer;line-height:1.5}details.card input{display:block;width:100%;background:var(--bg);color:var(--fg);border:1px solid var(--line);padding:8px;margin:5px 0}
    #reviewPreview{max-height:240px;overflow:auto;font-size:12px}#reviewPayload{background:#171717;color:#eee}#newMessages{color:var(--acc)}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
    .settings.open{max-height:55%;overflow:auto;flex:0 1 auto;min-height:0}
    .m-understanding .mascot{animation:bob-attentive 1.8s ease-in-out infinite}.m-insight .mascot,.m-success .mascot{animation:bob-insight .7s ease-in-out 2}.m-warning .mascot,.m-error .mascot{animation:bob-attentive 1.2s ease-in-out 2}
    @keyframes bob-attentive{0%,100%{transform:rotate(0)}50%{transform:rotate(-5deg)}}@keyframes bob-insight{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    .view{overflow-anchor:none}.panel-main{min-width:0}#body{overflow-wrap:anywhere}
  </style>
  <div class="wrap">
    <section class="panel" id="panel" data-tab="chat" aria-label="Bob, your project mentor">
      <div class="grip" id="grip" title="Drag to resize Bob width"></div><div class="height-grip" id="heightGrip" title="Drag to resize Bob height"></div><div class="corner-grip" id="cornerGrip" title="Drag to resize Bob width and height"></div><nav class="bob-nav" aria-label="Bob navigation"><div class="bob-nav-group"><button data-act="tab" data-tab="check" aria-label="Project Details" title="Project Details">▣</button><button data-act="tab" data-tab="chat" aria-label="Ask Bob" title="Ask Bob">▤</button></div><div class="bob-nav-group"><button data-act="gear" aria-label="Settings" title="Settings">⚙</button><button data-act="push" aria-label="Toggle page space" title="Make room for Bob">⇄</button><button data-act="close" aria-label="Collapse Bob" title="Collapse Bob">»</button></div></nav><div class="panel-main">
      <header>
        <div class="logo m-idle" id="heroLogo">${robot(true)}</div>
        <div class="ttl"><div class="name">Bob</div><div class="st" hidden><i class="dot" id="stDot"></i><span id="st">Ready to help</span></div></div>

        <button class="ib" data-act="newchat" aria-label="New chat" title="New chat">\u21BB</button>

      </header>
      <div class="ctx"><span class="it">Context:</span><span class="chip"><i class="dot" id="ctxDot"></i><span id="host"></span></span><span class="sync" id="sync" hidden>OFF</span></div>
      <div class="rail" id="rail" hidden></div>
      <div class="settings" id="settings">
        <label>OpenRouter API key (saved only inside this extension)</label>
        <input id="key" type="password" placeholder="sk-or-..." autocomplete="off"/>
        <label>Model</label><select id="model"></select>
        <label for="customModel">Custom OpenRouter model ID (optional)</label><input id="customModel" placeholder="provider/model"/><label>Your level</label><select id="level"><option value="unknown">Not sure</option><option>beginner</option><option>intermediate</option><option>advanced</option><option value="team">Team / company</option></select>
        <label for="widthRange">Sidebar width <span class="size-value" id="widthValue">320px</span></label><input class="size-range" id="widthRange" type="range" min="320" max="800" step="10" value="320"/><div class="size-controls"><button data-act="size" data-w="320">Compact</button><button data-act="size" data-w="440">Comfort</button><button data-act="size" data-w="600">Wide</button></div><label>Sidebar height <span class="size-value" id="heightValue">Full height</span></label><div class="size-controls"><button data-act="height" data-h="0">Full</button><button data-act="height" data-h="500">Medium</button><button data-act="height" data-h="700">Tall</button></div><div class="tg2"><button class="sw" id="swPush" role="switch" aria-checked="false" data-act="push"><i></i></button><span>Make room for Bob (push the page over)</span></div>
        <small>Local mentoring needs no key. Optional model review sends only the preview you approve; provider pricing and data policies vary. <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">Get one here</a>. Redaction is best effort. Review the payload and remove any remaining private information before sending.</small>
      </div>

      <span id="cnt" hidden></span><div class="monitor-bar" id="monitorBar"></div>
      <div class="view" id="chatView"><div id="msgs"></div><div class="chips" id="chips"></div></div>
      <div class="view" id="checkView"><div id="body"></div></div>
      <footer>
        <button class="b" data-act="reviewpreview">Preview optional AI review</button><button class="b" id="newMessages" data-act="latest" aria-live="polite" hidden>New guidance ↓</button><div id="reviewPreview"></div>
        <div class="inrow"><textarea id="input" rows="1" placeholder="Ask about the next step…"></textarea><button class="send" id="send" data-act="send" aria-label="Send">\u2192</button></div>
        <div class="foot"><span>Esc to collapse</span></div>
      </footer>
    </div></section>
    <div class="toast" id="toast" hidden data-act="toastopen" role="status"><button class="tclose" data-act="toastclose" aria-label="Dismiss">\u2715</button><div class="tt" id="tt"></div><div class="ts2" id="ts2"></div></div>
    <button class="bubble m-idle" id="bubble" aria-label="Open Bob">${robot()}<span class="badge" id="badge" hidden></span></button>
  </div>`;
  const $ = (id) => root.getElementById(id);
  const MINI = robot(true);

  // ------------------------------------------------------------- mood + place
  let moodTimer;
  function setMood(m, ms) {
    clearTimeout(moodTimer);
    S.mood = m;
    $("bubble").className = "bubble m-" + m;
    const hero = $("heroLogo");
    if (hero) hero.className = "logo m-" + m;
    const liveMini = $("msgs")?.lastElementChild?.querySelector?.(".mini.live");
    if (liveMini) liveMini.className = "mini live m-" + m;
    try { chrome_(); } catch (e) {}
    if (ms) moodTimer = setTimeout(() => setMood(S.busy ? "thinking" : "idle"), ms);
  }
  const BW = 68;
  function place() {
    if (!pos) pos = { x: innerWidth - BW - 20, y: innerHeight - BW - 20 };
    pos.x = Math.min(Math.max(8, pos.x), innerWidth - BW - 8);
    pos.y = Math.min(Math.max(8, pos.y), innerHeight - BW - 8);
    const b = $("bubble"), p = $("panel");
    b.style.left = pos.x + "px"; b.style.top = pos.y + "px";
    const t = $("toast");
    t.style.right = Math.max(8, innerWidth - pos.x - BW) + "px";
    if (pos.y > 150) { t.style.bottom = (innerHeight - pos.y + 8) + "px"; t.style.top = "auto"; }
    else { t.style.top = (pos.y + BW + 8) + "px"; t.style.bottom = "auto"; }
  }
  let toastTimer;
  function showToast(title, sub) {
    if (S.open) return false;
    $("tt").textContent = title; $("ts2").textContent = sub || "";
    $("toast").hidden = false; S.toastAt = Date.now(); setMood("happy", 3000);
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 15000);
    return true;
  }
  function hideToast() { $("toast").hidden = true; clearTimeout(toastTimer); }
  let enterTimer;
  function pulseEnter() {
    const b = $("body"); b.classList.add("enter");
    clearTimeout(enterTimer); enterTimer = setTimeout(() => b.classList.remove("enter"), 900);
  }
  function applyDock() {   // width of the sidebar, and (optionally) pushing the page over to make room
    const w = Math.min(Math.max(S.width, 280), Math.max(240, innerWidth - 12));
    $("panel").style.width = w + "px";
    const h = S.height > 0 ? Math.min(Math.max(S.height, 340), innerHeight) : innerHeight;
    $("panel").style.height = h + "px";
    $("panel").style.bottom = "auto";
    if ($("heightValue")) $("heightValue").textContent = S.height ? h + "px" : "Full height";
    if ($("widthValue")) $("widthValue").textContent = w + "px";
    if ($("widthRange")) $("widthRange").value = String(w);
    const de = document.documentElement;
    if (de && de.style) {
      if (S.push) de.style.transition = "margin-right .22s ease";
      de.style.marginRight = S.open && S.push ? w + "px" : "";
    }
  }
  function setOpen(on) {
    S.open = on; $("panel").classList.toggle("open", on); $("bubble").style.display = on ? "none" : "";
    S.lastHtml = ""; place(); applyDock(); if (on) { hideToast(); pulseEnter(); }
    if (on) { if (!S.msgs.length && !$("msgs").children.length) greet(); render(); if (S.consent && !S.paused) setTimeout(scan, 0); }
  }

  // ------------------------------------------------------------------- chat
  const TYPING = '<span class="typing" aria-label="Bob is thinking"><i></i><i></i><i></i></span>';
  const clean = (t) => t.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/<think>[\s\S]*$/, "").trim();
  function md(text) {
    let t = esc(text);
    t = t.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, l, c) => `<pre><code>${c.replace(/\n$/, "")}</code></pre>`);
    t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
    return t;
  }
  function maybeFollowChat(force = false) {
    const viewport = $("msgs")?.parentNode;
    if (!viewport) return;
    if (force || viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 110) viewport.scrollTop = viewport.scrollHeight;
  }
  function addMsg(role, text) {
    const viewport = $("msgs").parentNode;
    const follow = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 110;
    const row = document.createElement("div");
    row.className = "row " + (role === "user" ? "u" : "a");
    row.innerHTML = role === "user"
      ? `<div class="bub">${esc(text)}</div><div class="ts">Just now</div>`
      : `<div class="who"><span class="mini ${text ? "m-idle" : "live m-thinking"}">${MINI}</span><span>Bob</span></div><div class="bub">${md(text)}</div>`;
    $("msgs").appendChild(row);
    if (follow) maybeFollowChat(true); else { S.unread = true; $("newMessages").hidden = false; }
    return row.querySelector(".bub");
  }
  function setChips(list) {
    $("chips").innerHTML = list.map(([i, l, q], k) => `<button data-act="quick" data-i="${k}"><i>${i}</i>${esc(l)}</button>`).join("");
  }
  function greet() {
    addMsg("assistant", S.consent ? "I follow this project locally and post useful updates here. Open Project Details for requirements, implementation prompts and evidence." : "Enable monitoring below. I’ll follow this conversation locally and explain what your project needs next. Nothing is sent to a model unless you preview and approve a review.");
    $("chips").innerHTML = S.consent ? "" : '<button data-act="enable">Enable conversation monitoring</button>';
  }
  function newChat() { S.msgs = []; $("msgs").innerHTML = ""; S.lastBriefSignature = ""; greet(); if (S.consent && !S.paused) schedule(); }
  const modelOrder = () => S.customModel ? [S.customModel] : (S.model === "auto" ? cfg.models.slice(0,3) : [S.model]);
  function openSettings(on) { S.settingsOpen = on; $("settings").classList.toggle("open", on); }
  function setPage() { S.note = "Use Preview optional AI review to choose exactly what is sent."; render(); }
  function previewReview() {
    if (!S.project || S.paused) { addMsg("assistant", "Describe your project or enable monitoring first. Resume monitoring before reviewing the current conversation."); return; }
    S.remotePreview = { route: ROUTE_KEY(), signature: S.lastBriefSignature, input: window.BobReasoner.payload(S.project, S.normalized, S.level) };
    $("reviewPreview").innerHTML = '<details open><summary>Review what will be sent to OpenRouter</summary><p>Only this redacted summary and bounded excerpts will leave your browser. Inspect and edit them before sending.</p><textarea id="reviewPayload" aria-label="Editable review payload" style="width:100%;height:140px">'+esc(JSON.stringify(S.remotePreview.input,null,2))+'</textarea><button class="b" data-act="reviewsend">Send this review</button><button class="b" data-act="reviewcancel">Cancel</button></details>';
  }
  async function runReview() {
    if (S.busy || !S.remotePreview || S.paused) return;
    const pending = S.remotePreview;
    if (pending.route !== ROUTE_KEY() || pending.signature !== S.lastBriefSignature) { $("reviewPreview").innerHTML = "Project changed. Preview again before sending."; return; }
    const key = $("key").value.trim();
    if (!key) { openSettings(true); addMsg("assistant", "Add an OpenRouter key in Settings for optional model review. Local guidance still works."); return; }
    let input;
    try {
      const raw = $("reviewPayload").value;
      if (raw.length > 10000) throw new Error();
      input = JSON.parse(raw);
      if (!input || !Array.isArray(input.evidence) || !input.evidence.every(m => typeof m.id === "string" && ['user','assistant'].includes(m.role) && typeof m.text === "string")) throw new Error();
    } catch { addMsg("assistant", "The edited payload must be valid JSON under 10,000 characters with labelled evidence. Preview again to reset it."); return; }
    function redactValues(value) {
      if (typeof value === "string") return window.BobPrivacy.redact(value, 12000);
      if (Array.isArray(value)) return value.map(redactValues);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactValues(v)]));
      return value;
    }
    input = redactValues(input);
    S.busy = true; S.requestController = new AbortController(); const epoch = S.routeEpoch;
    setMood("thinking"); $("reviewPreview").innerHTML = '<p>Optional AI review is running…</p><button class="b" data-act="reviewcancel">Cancel request</button>';
    let raw = "";
    try {
      logSent("Approved model review: " + JSON.stringify(input).length + " redacted characters");
      for await (const chunk of B.stream({models:modelOrder(),messages:[{role:"system",content:window.BobReasoner.system},{role:"user",content:JSON.stringify(input)}],key,responseFormat:{type:"json_schema",json_schema:{name:"bob_review",strict:true,schema:window.BobReasoner.schema}},signal:S.requestController.signal})) {
        raw += chunk; if (raw.length > 24000) { S.requestController.abort(); throw new Error("The model response exceeded the size limit."); }
      }
      if (epoch !== S.routeEpoch || pending.signature !== S.lastBriefSignature || S.paused) return;
      S.remote = window.BobReasoner.validate(raw,input);
      addMsg("assistant", "**Model-assisted review (inferred, not verified)**\n\n"+S.remote.summary+"\n\n"+S.remote.requirements.slice(0,4).map((r,i)=>(i+1)+". **"+r.title+"** — "+r.why).join("\n\n")+"\n\nReview the evidence and assumptions under Project Details before acting.");
      setMood("happy",1800);
    } catch (error) { if (epoch === S.routeEpoch) addMsg("assistant", error.message+" Local recommendations are unchanged."); setMood("error",1500); }
    finally { S.busy = false; S.remotePreview = null; $("reviewPreview").innerHTML = ""; render(); }
  }
  async function sendChat(text) {
    text = String(text ?? $("input").value).trim(); if (!text || S.busy) return;
    if (location.pathname !== S.route) resetChat();
    $("input").value = ""; S.msgs.push({role:"user",content:text}); addMsg("user",text);
    const m = {id:"bob-user:"+Date.now(),role:"user",text,timestamp:new Date().toISOString()};
    if (!S.project || /\b(build|create|add|remove|without|no longer|using|called|named|implement|budget|platform)\b/i.test(text)) {
      S.normalized.push(m); S.project = window.BobProjectModel.build(S.normalized,S.project); S.lastBriefSignature = window.BobProjectModel.signature(S.project);
    }
    const plan = projectPlan();
    const query = text.toLowerCase().split(/\W+/).filter(w=>w.length>3);
    const selected = plan.find(r=>query.some(w=>r.title.toLowerCase().includes(w)));
    const reply = selected ? '**'+selected.title+'**\n\nWhy: '+selected.why+'\n\nWhat it does: '+selected.does+'\n\nAsk your coding AI: '+selected.implement+'\n\nHow to check: '+selected.verify
      : window.BobRequirements.briefing(S.project,plan);
    S.msgs.push({role:"assistant",content:reply,localOnly:true});addMsg("assistant",reply);persistProject();render();
  }
  function consentView() {
    return `<div class="card"><h3>Want me to watch along and help?</h3>
      <p>Say yes once and I'll keep an eye on your AI chats (Claude, ChatGPT and Gemini) while you build. When I see what you're making, I'll pop up and tell you what you'll need and how to keep it safe.</p>
      <p><b>What I look at:</b> recognised conversation messages and visible code in those messages, after you enable monitoring.</p>
      <p><b>Where it goes:</b> nowhere. The watching happens only on your computer. External analysis happens only when you preview and approve an optional OpenRouter review.</p>
      <p><b>What I save:</b> redacted project facts, their sources, and progress for up to 30 conversations on this computer. Raw conversation messages are not saved.</p>
      <p><b>What I never do:</b> type, click or send anything for you, or ask for your passwords or keys.</p>
      <p class="muted small">If you're under 18, ask a parent or guardian first. Reading chats is experimental and can stop working when a website changes. You can pause me any time.</p>
      <div class="btns"><button class="b main" data-act="enable">Yes, watch along</button></div></div>`;
  }
  function requirementCard(item, remote = false) {
    const id = esc(item.id), state = item.status || "inferred";
    return '<details class="card"><summary><b>'+esc(item.title)+'</b> · '+esc(state.replace(/-/g," "))+'</summary>'+
      '<p><b>Why do I need this?</b> '+esc(item.why)+'</p><p><b>What does it do?</b> '+esc(item.does)+'</p><p><b>What should I do?</b> '+esc(item.implement)+'</p><p><b>How do I check it?</b> '+esc(item.verify)+'</p>'+
      '<p class="muted small">'+esc(remote?'Model inference. Source: '+item.sourceId+' — '+item.quote+' Assumption: '+item.assumption:item.reason)+'</p>'+
      (!remote ? '<p class="small">'+item.evidence.map(e=>esc(e.role+' message: '+e.excerpt)).join('<br>')+'</p>' : '')+
      (item.verification?'<p class="small">User-reviewed evidence: '+esc(item.verification.reference)+' · Scope: '+esc(item.verification.scope)+'. This verifies only the stated scope.</p>':'')+
      '<div class="btns"><button class="b" data-act="'+(remote?'remoteprompt':'v3prompt')+'" data-key="'+id+'">Copy implementation prompt</button>'+
      (remote?'': '<button class="b" data-act="v3status" data-key="'+id+'" data-status="in-progress">In progress</button><button class="b" data-act="v3status" data-key="'+id+'" data-status="reported-complete">Reported done</button><button class="b" data-act="v3status" data-key="'+id+'" data-status="not-applicable">Not applicable</button><button class="b" data-act="v3status" data-key="'+id+'" data-status="not-started">Reset</button>')+'</div>'+
      (remote?'':'<details><summary>Record reviewed verification evidence</summary><label>Evidence reference (test, configuration or manual check)<input id="evidence-'+id+'"/></label><label>Exactly what behavior was checked<input id="scope-'+id+'"/></label><button class="b" data-act="verify" data-key="'+id+'">I reviewed this evidence</button></details>')+'</details>';
  }
  function universalProjectView() {
    const m=S.project;
    if(!m)return '<div class="card">Waiting for a project description in the conversation.</div>';
    const plan=projectPlan(), pending=plan.filter(r=>!['reported-complete','verified','not-applicable'].includes(r.status));
    let h='<div class="card"><h3>'+esc(m.identity.name?.value||m.identity.description?.value||'Project not yet identified')+'</h3><p>Type: '+esc(m.identity.category.value)+' · Stage: '+esc(m.progress.stage)+'</p><p>Platforms: '+esc(m.environment.platforms?.value?.join(', ')||'Unknown')+' · Confidence: '+Math.round(m.identity.confidence*100)+'%</p><p>Intended users: '+esc(m.identity.users?.value||'Not specified')+'</p><p>Constraints: '+esc(Object.values(m.constraints).map(f=>f.value).join('; ')||'Not specified')+'</p><p class="muted small">Local inference from visible messages. Reported completion is not verified implementation.</p></div>';
    if(m.uncertainties.length)h+='<div class="note">'+esc(m.uncertainties[0])+'</div>';
    if(m.conflicts.length)h+='<details class="card"><summary>Conflicting evidence</summary>'+m.conflicts.map(c=>'<p>'+esc(c.key+': '+c.reason)+'</p>').join('')+'</details>';
    if(m.progress.codeFindings?.length)h+='<details class="card"><summary>Possible issues in shared code</summary>'+m.progress.codeFindings.map(f=>'<p><b>'+esc(f.title)+'</b><br>'+esc(f.why)+'<br>'+esc(f.fix)+'<br>Evidence: '+esc(f.sourceId+' line '+f.line+': '+f.evidence)+'. Pattern match only; review the surrounding code.</p>').join('')+'</details>';
    h+='<h3>What needs attention</h3>'+pending.slice(0,4).map(r=>requirementCard(r)).join('');
    if(pending.length>4)h+='<details><summary>'+ (pending.length-4)+' more applicable requirements</summary>'+[...new Set(pending.slice(4).map(r=>r.category))].map(g=>'<h4>'+esc(g)+'</h4>'+pending.slice(4).filter(r=>r.category===g).map(r=>requirementCard(r)).join('')).join('')+'</details>';
    h+='<details><summary>Completed or reported complete</summary>'+plan.filter(r=>['reported-complete','verified'].includes(r.status)).map(r=>requirementCard(r)).join('')+'<p>Verification covers recorded evidence only.</p></details>';
    const excluded=Object.values(m.capabilities).filter(f=>f.classification==='excluded');
    h+='<details><summary>What does not apply</summary>'+excluded.map(f=>'<p>'+esc(f.value)+' — explicitly excluded: '+esc(f.source.excerpt)+'</p>').join('')+plan.filter(r=>r.status==='not-applicable').map(r=>requirementCard(r)).join('')+'</details>';
    h+='<details><summary>Project facts and sources</summary>'+Object.values(m.capabilities).map(f=>'<p><b>'+esc(f.value)+'</b>: '+esc(f.classification+' / '+f.stage)+' · '+Math.round(f.confidence*100)+'%<br>'+esc(f.source.role+': '+f.source.excerpt)+'<br>'+esc(f.timestamp)+'</p>').join('')+'</details>';
    if(m.suggestions.length)h+='<details><summary>Suggestions, not confirmed requirements</summary>'+m.suggestions.map(f=>'<p>'+esc(f.value+' — '+f.source.role+': '+f.source.excerpt)+'</p>').join('')+'</details>';
    if(S.remote)h+='<h3>Optional model review · inferred</h3>'+S.remote.requirements.map(r=>requirementCard(r,true)).join('');
    return h;
  }
  function checkView() {
    if(!S.consent&&!S.project)return consentView();
    return (S.note?'<div class="note">'+esc(S.note)+'</div>':'')+universalProjectView()+'<div class="btns"><button class="b danger" data-act="delete">'+(S.confirmDelete?'Confirm deletion':'Delete Bob data')+'</button></div>';
  }
  function chrome_() {   // header status, context row, rail, badges
    if (!B.alive()) {
      $("stDot").className = "dot warn"; $("ctxDot").className = "dot warn";
      $("st").textContent = "Bob was updated. Refresh this page."; $("sync").textContent = "REFRESH"; return;
    }

    const seen = S.reads.users + S.reads.code > 0 || S.reads.text;
    let dot = "", text = "Ready to help", sync = "OFF";
    if (S.consent && S.paused) { dot = "pause"; text = "Paused"; sync = "PAUSED"; }
    else if (S.consent && !S.scanned) { dot = "warn"; text = "Getting ready\u2026"; sync = "\u2026"; }
    else if (S.consent && seen) {
      dot = "on"; sync = "WATCHING";
      text = S.reads.users ? `Watching this chat \u00B7 ${plural(S.reads.users, "message")}, ${plural(S.reads.code, "code block")}` : `Watching this page \u00B7 ${plural(S.reads.code, "code block")}`;
    } else if (S.consent) { dot = "warn"; text = "Can't read this chat yet"; sync = "CAN'T READ"; }
    $("stDot").className = "dot " + dot; $("ctxDot").className = "dot " + dot;
    $("st").textContent = text; $("sync").textContent = sync;
    const n = S.unread ? 1 : 0;
    $("badge").hidden = n === 0; $("badge").textContent = String(n);
    $("cnt").hidden = n === 0; $("cnt").textContent = String(n);
  }
  function render() {
    chrome_();
    $("monitorBar").innerHTML = !B.alive() ? '<p>Bob was updated. Refresh this page.</p>' : '<span>Local analysis · '+(!S.consent?'Off':S.paused?'Paused':S.via||'Waiting for messages')+'</span> <button class="b" data-act="'+(!S.consent?'enable':S.paused?'resume':'pause')+'">'+(!S.consent?'Enable monitoring':S.paused?'Resume':'Pause')+'</button>'+(S.consent?' <button class="b" data-act="disable">Disable</button>':'');
    if (!S.open || S.tab !== "check") return;
    const html = checkView();
    if (html === S.lastHtml) return;
    S.lastHtml = html; $("body").innerHTML = html;
  }

  // ---------------------------------------------------------------- actions
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (e2) {}
      ta.remove(); return ok;
    }
  }
  async function wipe() {
    stopReading(); S.requestController?.abort(); await store.clear();
    try { await chrome.storage.local.remove("bob"); await B.clearPrefs(); } catch (e) {}
    S.consent = false; S.paused = false; S.learned = new Set(); S.sent = []; S.confirmDelete = false; S.details = false;
    S.key = ""; $("key").value = ""; S.level = "unknown"; S.model = "auto";
    S.doneAll = {}; resetChat(); S.scanned = false; S.lastHtml = "";
  }

  // mousedown on buttons must not steal the page's highlight or focus
  root.addEventListener("mousedown", (e) => { if (e.target.closest && e.target.closest("button")) e.preventDefault(); });
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest && e.target.closest("[data-act]"); if (!btn) return;
    const act = btn.dataset.act;
    const keyEl = btn.closest("[data-key]"); const key = keyEl ? keyEl.dataset.key : "";
    if (act !== "delete") S.confirmDelete = false;
    switch (act) {
      case "close": setOpen(false); return;
      case "gear": openSettings(!S.settingsOpen); return;
      case "newchat": newChat(); return;
      case "tab": S.tab = btn.dataset.tab; $("panel").dataset.tab = S.tab; S.lastHtml = ""; pulseEnter(); break;
      case "usepage": setPage(!S.usePage); return;
      case "v3prompt": {
        const item=projectPlan().find(x=>x.id===key);
        if(item) { const ok=await copyText(item.prompt); S.note=ok?"Implementation prompt copied.":"Could not copy. Select the implementation text in the card."; }
        break;
      }
      case "remoteprompt": { const item=S.remote?.requirements.find(r=>r.id===key); if(item)await copyText(window.BobRequirements.prompt(S.project,item)); return; }
      case "v3status": {
        if(projectPlan().some(r=>r.id===key)&&["not-started","in-progress","reported-complete","not-applicable"].includes(btn.dataset.status)) S.v3Status[key]=window.BobVerification.transition(btn.dataset.status);
        persistProject();S.lastHtml=""; break;
      }
      case "verify": {
        if(!projectPlan().some(r=>r.id===key))return;
        try { S.v3Status[key]=window.BobVerification.transition("verified",{reviewed:true,reference:window.BobPrivacy.redact($("evidence-"+key).value,1000),scope:window.BobPrivacy.redact($("scope-"+key).value,500)});S.v3Status[key].signature=window.BobProjectModel.signature(S.project);persistProject();S.note="Evidence recorded as user-reviewed. Bob has not independently executed the check."; }
        catch(error){S.note=error.message;}
        S.lastHtml="";break;
      }
      case "latest": maybeFollowChat(true); S.unread=false; $("newMessages").hidden=true; return;
      case "reviewpreview": previewReview(); return;
      case "reviewsend": await runReview(); return;
      case "reviewcancel": S.requestController?.abort(); S.remotePreview=null; $("reviewPreview").innerHTML=""; return;
      case "disable": S.requestController?.abort();S.consent=false;S.paused=false;stopReading();reader.clear();S.normalized=[];S.remotePreview=null;$("reviewPreview").innerHTML="";await save(true).catch(() => {});break;
      case "height": S.height = Number(btn.dataset.h) || 0; applyDock(); B.savePref("h", String(S.height)); return;
      case "size": S.width = Number(btn.dataset.w) || 320; applyDock(); B.savePref("w", String(S.width)); return;
      case "push": S.push = !S.push; $("swPush").classList.toggle("on", S.push); $("swPush").setAttribute("aria-checked", String(S.push)); B.savePref("push", S.push ? "1" : "0"); applyDock(); return;
      case "code": { const t = $("input"); t.value += (t.value && !t.value.endsWith("\n") ? "\n" : "") + "```\n\n```"; t.focus(); return; }
      case "send": sendChat(); return;
      case "quick": { const q = QUICK[Number(btn.dataset.i)]; if (q) { setPage(true); sendChat(q[2]); } return; }
      case "enable": S.consent = true; S.paused = false; S.introSeen = true; hideToast(); try { await save(true); } catch { S.note = "Monitoring permission could not be saved. Recheck it after refreshing."; } startReading(); break;
      case "pause": S.paused = true; S.requestController?.abort(); stopReading(); await save(true).catch(() => {}); break;
      case "resume": S.paused = false; await save(true).catch(() => {}); startReading(); break;
      case "delete": if (!S.confirmDelete) { S.confirmDelete = true; break; } await wipe(); break;
      case "toastopen": hideToast(); S.tab = "chat"; $("panel").dataset.tab = "chat"; setOpen(true); return;
      case "toastclose": hideToast(); return;

    }
    render();
  });

  // settings fields
  $("key").addEventListener("change", (e) => { S.key = e.target.value.trim(); B.savePref("key", S.key); });
  $("model").addEventListener("change", (e) => { S.model = e.target.value; B.savePref("model", S.model); });
  $("level").addEventListener("change", (e) => { S.level = e.target.value; B.savePref("level", S.level); });
  // Enter / Escape are relayed here by shield.js
  host.addEventListener("bob-send", () => sendChat());
  host.addEventListener("bob-esc", () => { if (S.open) setOpen(false); });

  // bubble: click to open, drag to move
  let drag = null, moved = false;
  const bubble = $("bubble");
  bubble.addEventListener("pointerdown", (e) => { drag = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; moved = false; bubble.setPointerCapture && bubble.setPointerCapture(e.pointerId); });
  bubble.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (moved) { pos.x = drag.ox + dx; pos.y = drag.oy + dy; place(); }
  });
  bubble.addEventListener("pointerup", () => { if (moved) B.savePref("pos", JSON.stringify(pos)); drag = null; });
  bubble.addEventListener("click", () => { if (moved) { moved = false; return; } setOpen(!S.open); });
  addEventListener("resize", () => { place(); applyDock(); });
  // drag the left edge to resize
  let rz = null;
  const grip = $("grip");
  grip.addEventListener("pointerdown", (e) => { rz = { sx: e.clientX, w: S.width }; grip.setPointerCapture && grip.setPointerCapture(e.pointerId); });
  grip.addEventListener("pointermove", (e) => {
    if (!rz) return;
    S.width = Math.min(Math.max(rz.w + (rz.sx - e.clientX), 320), Math.max(320, Math.round(innerWidth * 0.9))); applyDock();
  });
  grip.addEventListener("pointerup", () => { if (rz) B.savePref("w", String(S.width)); rz = null; });

  function attachResizeGrip(id, resizeWidth, resizeHeight) {
    const gripEl = $(id);
    let start = null;
    gripEl.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      start = { x:e.clientX, y:e.clientY, w:S.width, h:S.height || innerHeight };
      gripEl.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    gripEl.addEventListener("pointermove", e => {
      if (!start) return;
      if (resizeWidth) S.width = Math.min(Math.max(start.w + start.x - e.clientX, 320), Math.max(320, Math.round(innerWidth*.9)));
      if (resizeHeight) S.height = Math.min(Math.max(start.h + e.clientY - start.y, 340), innerHeight);
      applyDock();
    });
    const finish = () => {
      if (!start) return;
      start = null;
      B.savePref("w", String(S.width));
      B.savePref("h", String(S.height));
    };
    gripEl.addEventListener("pointerup",finish);
    gripEl.addEventListener("pointercancel",finish);
    gripEl.addEventListener("lostpointercapture",finish);
  }
  attachResizeGrip("heightGrip", false, true);
  attachResizeGrip("cornerGrip", true, true);
  $("widthRange").addEventListener("input", e => { S.width = Number(e.target.value) || 320; applyDock(); });
  $("widthRange").addEventListener("change", () => B.savePref("w", String(S.width)));
  $("customModel").addEventListener("change", () => { const value=$("customModel").value.trim(); if(!value||/^[\w/.:@-]{1,150}$/.test(value)){S.customModel=value;B.savePref("customModel",value);} });
  const navigationTimer=setInterval(() => {
    if (!B.alive()) { stopReading(); clearInterval(navigationTimer); render(); return; }
    if (location.pathname !== S.route) { resetChat(); render(); if(S.consent&&!S.paused)startReading(); }
  },1000);
  window.addEventListener("pagehide",()=>{clearInterval(navigationTimer);stopReading();S.requestController?.abort();});
  // ------------------------------------------------------------------ start
  (async function init() {
    await load();
    $("host").textContent = location.hostname;
    $("model").innerHTML = '<option value="auto">Auto (best available)</option>' + cfg.models.map((m) => `<option value="${esc(m)}">${esc(m.replace(":free", ""))}</option>`).join("");
    $("customModel").value = S.customModel;
    $("model").value = S.model; $("key").value = S.key; $("level").value = S.level;
    document.body.appendChild(host);
    $("swPush").classList.toggle("on", S.push); $("swPush").setAttribute("aria-checked", String(S.push));
    place(); applyDock(); render();
    if (S.consent && !S.paused) startReading();
    else if (!S.introSeen) setTimeout(() => {
      if (!S.consent && showToast("Hi! I'm Bob \u{1F44B}", "Want me to watch along and help you build safely? Tap me.")) { S.introSeen = true; save(); }
    }, 1500);
  })();
})();
