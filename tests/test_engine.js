// Run: node test_engine.js
const assert = require("assert");
const E = require(require("fs").existsSync(__dirname + "/engine.js") ? "./engine.js" : "../engine.js");
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("FAIL  " + name + "\n      " + e.message); }
}
const ids = (code) => E.scanCode(code).map((f) => f.id);
const FAKE = "sk-" + "A1b2C3d4E5f6G7h8I9j0K1l2";

console.log("Security rules");
t("plain-text password is flagged", () =>
  assert(ids("db.users.insert({name, password: req.body.password})").includes("plain-password")));
t("hashed password is NOT flagged", () =>
  assert(!ids("const h = await bcrypt.hash(req.body.password, 10);\ndb.users.insert({name, password: h})").includes("plain-password")));
t("md5 for passwords flagged", () =>
  assert(ids("password_hash = hashlib.md5(password.encode()).hexdigest()").includes("weak-hash")));
t("md5 without passwords NOT flagged", () =>
  assert(!ids("checksum = hashlib.md5(data).hexdigest()").includes("weak-hash")));
t("innerHTML flagged", () => assert(ids("el.innerHTML = userText;").includes("xss")));
t("textContent not flagged", () => assert(!ids("el.textContent = userText;").includes("xss")));
t("eval flagged", () => assert(ids("eval(input)").includes("eval")));
t("SQL concatenation flagged", () =>
  assert(ids('db.query("SELECT * FROM users WHERE id=" + id)').includes("sql-injection")));
t("SQL template literal flagged", () =>
  assert(ids("db.query(`SELECT * FROM users WHERE id=${id}`)").includes("sql-injection")));
t("python f-string SQL flagged", () =>
  assert(ids('cur.execute(f"SELECT * FROM users WHERE id={uid}")').includes("sql-injection")));
t("parameterized SQL NOT flagged", () =>
  assert(!ids('db.query("SELECT name FROM users WHERE id = ?", [id])').includes("sql-injection")));
t("open CORS flagged", () => assert(ids("app.use(cors())").includes("cors-open")));
t("weak jwt secret flagged", () =>
  assert(ids('const token = jwt.sign({id}, "secret")').includes("jwt-weak")));
t("debug=True flagged", () => assert(ids("app.run(debug=True)").includes("debug-on")));
t("admin/admin flagged", () => assert(ids('const user = "admin", password = "admin"').includes("default-creds")));
t("verify=False flagged", () => assert(ids("requests.get(url, verify=False)").includes("ssl-off")));
t("token in localStorage flagged", () =>
  assert(ids('localStorage.setItem("authToken", t)').includes("token-local")));
t("Math.random for token flagged", () =>
  assert(ids("const resetToken = Math.random().toString(36)").includes("random-token")));
t("Math.random for animation NOT flagged", () =>
  assert(!ids("const x = Math.random() * 100").includes("random-token")));
t("password logging flagged", () =>
  assert(ids("console.log('pw', password)").includes("log-secrets")));
t("paid flag in browser flagged", () =>
  assert(ids('localStorage.setItem("isPro", true)').includes("paid-in-browser")));
t("secret in VITE_ variable flagged", () =>
  assert(ids("VITE_STRIPE_SECRET=abc").includes("public-env-secret")));
t("unsigned webhook flagged, signed not", () => {
  assert(ids("app.post('/stripe/webhook', (req,res)=>{ const e=req.body; })").includes("unsigned-webhook"));
  assert(!ids("app.post('/stripe/webhook', (req,res)=>{ stripe.webhooks.constructEvent(b, sig, k) })").includes("unsigned-webhook"));
});
t("unchecked upload flagged, limited not", () => {
  assert(ids("const up = multer({dest:'u/'}); app.post('/up', up.single('f'), h)").includes("upload-unchecked"));
  assert(!ids("const up = multer({dest:'u/', limits:{fileSize:1e6}})").includes("upload-unchecked"));
});
t("login without rate limit flagged, with limit not", () => {
  assert(ids("app.post('/login', handler)").includes("login-no-limit"));
  assert(!ids("app.post('/login', rateLimit(), handler)").includes("login-no-limit"));
});
t("fetch without catch flagged, with try not", () => {
  assert(ids("const r = await fetch(url)").includes("fetch-no-catch"));
  assert(!ids("try { await fetch(url) } catch (e) {}").includes("fetch-no-catch"));
});
t("SELECT * without LIMIT flagged", () => assert(ids("SELECT * FROM orders").includes("select-star")));
t("clean code finds nothing", () =>
  assert.deepStrictEqual(ids("function add(a, b) { return a + b; }"), []));

console.log("Secrets are never shown in full");
t("API key is flagged but masked", () => {
  const f = E.scanCode('const apiKey = "' + FAKE + '";');
  assert(f.some((x) => x.id === "hardcoded-secret"));
  assert(!JSON.stringify(f).includes(FAKE), "full key leaked");
  assert(!JSON.stringify(f).includes("A1b2C3d4E5f6"), "key body leaked");
});
t("password literal is masked in evidence", () => {
  const f = E.scanCode('password = "hunter2hunter2hunter2"');
  assert(!JSON.stringify(f).includes("hunter2hunter2"));
});
t("bearer token is masked", () =>
  assert(!E.maskLine("Authorization: Bearer abcdef1234567890abcdef").includes("abcdef1234567890")));
t("placeholder keys are not flagged", () =>
  assert(!ids('const apiKey = "your-api-key-here"').includes("hardcoded-secret")));
t("findings are sorted most serious first", () => {
  const f = E.scanCode("SELECT * FROM orders\nel.innerHTML = x");
  assert.strictEqual(f[0].severity, "high");
});

console.log("Lessons are well-formed data");
t("every rule has all fields", () => {
  for (const r of E.RULES)
    for (const k of ["id", "title", "severity", "kind", "why", "analogy", "fix", "lastReviewed"])
      assert(r[k], r.id + " missing " + k);
});
t("rule ids are unique and there are 20+", () => {
  assert.strictEqual(new Set(E.RULES.map((r) => r.id)).size, E.RULES.length);
  assert(E.checkedCount() >= 20);
});
t("every need has 2+ options and a valid pick", () => {
  for (const [id, n] of Object.entries(E.NEEDS)) {
    assert(n.options.length >= 2, id);
    const ok = new Set(n.options.map((o) => o.id));
    assert(ok.has(n.pick.default), id + " default pick");
    for (const v of Object.values(n.pick.byType)) assert(ok.has(v), id + " byType");
    for (const o of n.options) for (const k of ["name", "what", "gives", "difficulty", "best", "notWhen"]) assert(o[k], id + "/" + o.id + " " + k);
  }
});
t("every type need exists", () => {
  for (const list of Object.values(E.TYPE_NEEDS)) for (const id of list) assert(E.NEEDS[id], id);
});

console.log("What are they making");
t("game detected", () => assert.strictEqual(E.detectProject(["I want to make a minecraft style game"]).type, "game"));
t("online shop detected", () => assert.strictEqual(E.detectProject(["build me an online shop with checkout"]).type, "store"));
t("nothing -> unknown, confidence 0", () => {
  const p = E.detectProject(["hello there"]);
  assert.strictEqual(p.type, "unknown"); assert.strictEqual(p.confidence, 0);
});
t("newer message wins when they change their mind", () =>
  assert.strictEqual(E.detectProject(["I want a minecraft game", "nvm I want a portfolio website"]).type, "website"));
t("a tie is low confidence (so Bob asks)", () =>
  assert(E.detectProject(["a game or a website"]).confidence < 0.6));
t("one clear mention is confident enough", () =>
  assert(E.detectProject(["I'm making a game"]).confidence >= 0.6));

console.log("Needs plan");
t("shop plan includes payments", () => assert(E.planNeeds("store").some((n) => n.id === "payments")));
t("learned needs are not repeated", () =>
  assert(!E.planNeeds("store", new Set(["need:hosting"])).some((n) => n.id === "hosting")));
t("unknown type has no needs (Bob asks instead of guessing)", () => assert.strictEqual(E.planNeeds("unknown").length, 0));
t("pick depends on type", () => {
  assert.strictEqual(E.planNeeds("mobile").find((n) => n.id === "database").pick.id, "firebase");
  assert.strictEqual(E.planNeeds("website").find((n) => n.id === "database").pick.id, "supabase");
});

console.log("Prompts");
t("prompt asks for simple words and full code", () => {
  const p = E.findingPrompt(E.scanCode("el.innerHTML = x")[0], "a website");
  assert(/simple words/.test(p) && /full changed code/.test(p) && /a website/.test(p));
});
t("prompt never contains a full secret", () => {
  const f = E.scanCode('const apiKey = "' + FAKE + '"')[0];
  assert(!E.findingPrompt(f, "an app").includes(FAKE));
});
t("need prompt names the pick", () => {
  const n = E.planNeeds("website").find((x) => x.id === "hosting");
  assert(E.needPrompt(n, "a website").includes("Vercel"));
});

console.log("Prove it");
t("gone evidence + code visible => fixed", () =>
  assert.strictEqual(E.reconcile({ xss: "open" }, new Set(), true).xss, "fixed"));
t("gone evidence + no code visible => unverified (not green)", () =>
  assert.strictEqual(E.reconcile({ xss: "open" }, new Set(), false).xss, "unverified"));
t("still there => open", () =>
  assert.strictEqual(E.reconcile({ xss: "open" }, new Set(["xss"]), true).xss, "open"));
t("fixed issue that comes back => open again", () =>
  assert.strictEqual(E.reconcile({ xss: "fixed" }, new Set(["xss"]), true).xss, "open"));


console.log("Features Bob notices");
t("login, payments, AI and uploads are spotted in plain talk", () => {
  const f = E.detectFeatures(["I want people to sign up and log in", "add Stripe payments", "use the OpenAI API for a chatbot", "let users upload a profile picture"]);
  for (const id of ["login", "payments", "ai", "uploads"]) assert(f.includes(id), id);
});
t("a plain chat with no features finds none", () => assert.deepStrictEqual(E.detectFeatures(["make my page blue"]), []));
t("leaderboards mean online play", () => assert(E.detectFeatures(["add a global leaderboard"]).includes("multiplayer")));
t("'for kids' is noticed", () => assert(E.detectFeatures(["a drawing app for kids"]).includes("kids")));

console.log("Safety checklist is tailored");
const idsOf = (type, feats) => E.buildChecklist(type, feats).map((c) => c.id);
t("everyone gets the basics (HTTPS, hidden keys, backups...)", () => {
  for (const type of ["website", "game", "mobile", "bot", "store", "backend", "unknown"])
    for (const id of ["https", "secrets-hidden", "env-ignored", "validate-input", "backups-test"]) assert(idsOf(type, []).includes(id), type + " missing " + id);
});
t("a website gets headers + trusted scripts, a game does not", () => {
  assert(idsOf("website", []).includes("security-headers") && idsOf("website", []).includes("trusted-scripts"));
  assert(!idsOf("game", []).includes("security-headers"));
});
t("a game gets 'keep scores on the server'", () => assert(idsOf("game", []).includes("server-truth")));
t("a phone app gets 'no keys inside the app'", () => assert(idsOf("mobile", []).includes("keys-in-app")));
t("a bot gets token + command permission steps", () => { const i = idsOf("bot", []); assert(i.includes("bot-token") && i.includes("bot-permissions")); });
t("a shop gets prices-on-server AND all payment steps (payments are implied)", () => {
  const i = idsOf("store", []);
  for (const id of ["price-server", "card-details", "pay-confirm", "pay-webhook", "pay-test", "row-rules", "password-hash", "collect-less"]) assert(i.includes(id), id);
});
t("an API gets 'check who is allowed on every request'", () => assert(idsOf("backend", []).includes("authz-every")));
t("login in the plan adds login steps", () => {
  const i = idsOf("website", ["login"]);
  for (const id of ["password-hash", "login-limit", "sessions"]) assert(i.includes(id), id);
  assert(!idsOf("website", []).includes("password-hash"));
});
t("database in the plan adds row rules + safe queries", () => { const i = idsOf("website", ["database"]); assert(i.includes("row-rules") && i.includes("sql-injection")); });
t("AI in the plan adds key, spend limit and prompt-injection steps", () => { const i = idsOf("website", ["ai"]); for (const id of ["ai-key", "ai-spend", "ai-injection"]) assert(i.includes(id), id); });
t("kids in the plan adds the kids step", () => assert(idsOf("game", ["kids"]).includes("kids-privacy")));
t("unknown type still gets basics + feature steps, but no type-only steps", () => {
  const i = idsOf("unknown", ["payments"]);
  assert(i.includes("https") && i.includes("pay-webhook") && !i.includes("price-server") && !i.includes("bot-token"));
});
t("most serious steps come first", () => {
  const list = E.buildChecklist("store", ["login"]);
  assert.strictEqual(list[0].severity, "high");
  const sev = list.map((c) => E.SEV_ORDER[c.severity]);
  assert.deepStrictEqual(sev, [...sev].sort((a, b) => a - b));
});
t("each step explains why it applies", () => {
  const w = E.buildChecklist("website", ["login"]);
  assert(/Because you're making a website/.test(w.find((c) => c.id === "security-headers").reason));
  assert(/Because your plan has login/.test(w.find((c) => c.id === "password-hash").reason));
  assert(/Every project/.test(w.find((c) => c.id === "https").reason));
});
t("done steps are flagged", () => {
  const list = E.buildChecklist("website", [], new Set(["https"]));
  assert(list.find((c) => c.id === "https").done && !list.find((c) => c.id === "updates").done);
});
t("checklist ids are unique and every step is complete", () => {
  assert.strictEqual(new Set(E.CHECKS.map((c) => c.id)).size, E.CHECKS.length);
  for (const c of E.CHECKS) for (const k of ["id", "title", "severity", "why", "analogy", "todo", "lastReviewed"]) assert(c[k], c.id + " " + k);
  assert(E.CHECKS.length >= 50);
});
t("checklist prompt is paste-ready: goal, simple words, full code", () => {
  const p = E.checkPrompt(E.CHECKS[0], "a website");
  assert(/a website/.test(p) && /simple words/.test(p) && /full changed code/.test(p) && /HTTPS/.test(p));
});
t("no checklist step quotes a price or a limit from memory", () => {
  for (const c of E.CHECKS) assert(!/\$\d|per month|free tier of \d/i.test(c.todo + c.why), c.id);
});
t("every type has a roadmap that mentions the safety steps", () => {
  for (const type of Object.keys(E.TYPE_NEEDS)) assert(E.ROADMAPS[type] && E.ROADMAPS[type].some((x) => /safety/i.test(x)), type);
});

console.log("Safety progress score");
t("nothing ticked = 0, everything ticked = 100", () => {
  const list = E.buildChecklist("website", []);
  assert.strictEqual(E.safetyScore(list, 0), 0);
  assert.strictEqual(E.safetyScore(list.map((c) => ({ ...c, done: true })), 0), 100);
});
t("serious steps move the score more than small ones", () => {
  const list = E.buildChecklist("website", []);
  const hi = list.find((c) => c.severity === "high"), lo = list.find((c) => c.severity === "low");
  const a = E.safetyScore(list.map((c) => ({ ...c, done: c.id === hi.id })), 0);
  const b = E.safetyScore(list.map((c) => ({ ...c, done: c.id === lo.id })), 0);
  assert(a > b);
});
t("open serious code problems lower the score, never below 0", () => {
  const list = E.buildChecklist("website", []).map((c) => ({ ...c, done: true }));
  assert.strictEqual(E.safetyScore(list, 2), 80);
  assert.strictEqual(E.safetyScore(E.buildChecklist("website", []), 5), 0);
});
t("empty list is 0, not a crash", () => assert.strictEqual(E.safetyScore([], 0), 0));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
