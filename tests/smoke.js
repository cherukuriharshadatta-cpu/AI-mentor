// Fake-page test of the whole automatic flow.  Run: node smoke.js
const T = require("./harness.js")({
  stored: { bob: { consentAll: true } },
  config: { toastGapMs: 0 },
  page: { user: ["I want to make a minecraft style game"], asst: ["Sure! Here is the code"],
    pre: ["db.users.insert({name, password: req.body.password})\nconst apiKey = \"sk-" + "A1b2C3d4E5f6G7h8I9j0K1l2\""] },
});
const { $$, wait, click, check, PAGE, hostEl, calls } = T;

(async () => {
  await wait(800);
  console.log("Bob watches by himself and speaks up");
  check("pop-up appears on its own, with the panel closed", $$("toast").hidden === false && /Looks like you're building a game!/.test($$("tt").textContent));
  check("pop-up tells you what Bob will do", /what you'll need and how to keep it safe/.test($$("ts2").textContent));
  check("mascot reacts", $$("bubble").className === "bubble m-happy");
  check("badge already counts the problems found in code", $$("badge").hidden === false && Number($$("badge").textContent) >= 2);
  check("header says he is watching, with counts", /Watching this chat/.test($$("st").textContent) && /1 message/.test($$("st").textContent) && $$("sync").textContent === "WATCHING");

  await click("toastopen");
  check("tapping the pop-up opens the Checkup", $$("panel").classList._s.has("open") && $$("panel").dataset.tab === "check" && $$("toast").hidden === true);
  let html = $$("body").innerHTML;
  console.log("What the vibe coder sees");
  check("'You're building a game' + a roadmap", /You're building <b>a game<\/b>/.test(html) && /Your roadmap/.test(html) && /Do the safety steps below/.test(html));
  check("code problem shown with a secret masked", /Passwords are saved as plain text/.test(html) && !html.includes("A1b2C3d4E5f6"));
  check("safety checklist with progress bar", /Safety checklist · 0 of \d+ done/.test(html) && /class="bar"/.test(html));
  check("only two next steps at a time (plus the code finding)", (html.match(/data-key="chk:/g) || []).length === 2);
  check("most serious steps come first (HTTPS, hidden keys)", /Make sure your site uses HTTPS/.test(html) && /Keep every secret key out of your code/.test(html));
  check("each step says why it applies to THIS project", /Every project that goes online needs this/.test(html));
  check("first needs card shown, the rest behind a button", /What you will need/.test(html) && /more things you'll need/.test(html));
  check("no raw ids or jargon codes in the main view", !/>rule:|>chk:|>need:/.test(html));

  console.log("The sidebar");
  check("Bob docks on the right edge as a full-height sidebar; the floating bubble steps aside", $$("panel").classList._s.has("open") && $$("bubble").style.display === "none");
  const rail = $$("rail").innerHTML;
  check("step rail: Watch and Understand are lit", /st2 done( fresh)?"><span class="c">✓<\/span><span>Watch/.test(rail) && /st2 done( fresh)?"><span class="c">✓<\/span><span>Understand/.test(rail));
  check("step rail: the next step glows as 'active'", /st2 active"><span class="c">3<\/span><span>Learn/.test(rail));
  check("Safety progress gauge shows, starting at 0%", /Safety progress/.test(html) && /class="gn">0<small>/.test(html));

  await click("showlist");
  html = $$("body").innerHTML;
  check("full list has the game-specific step", /Keep scores and wins on the server/.test(html));
  check("full list does NOT have website-only steps", !/Add safety headers/.test(html));
  await click("rowopen", {}, "chk:server-truth");
  check("tapping a row opens its card", /anything on the player(&#39;|')s computer can be changed/i.test($$("body").innerHTML));

  await click("done", {}, "chk:https");
  check("'I did this' moves the progress bar", /Safety checklist · 1 of \d+ done/.test($$("body").innerHTML));
  check("step rail 'Protect' is not lit while serious steps are still open", !/st2 done( fresh)?"><span class="c">✓<\/span><span>Protect/.test($$("rail").innerHTML));
  for (const id of ["secrets-hidden", "env-ignored", "validate-input", "server-truth"]) await click("done", {}, "chk:" + id);
  check("ticking serious steps raises the Safety progress gauge", Number(/class="gn">(\d+)</.exec($$("body").innerHTML)[1]) > 0);
  check("'Protect' lights up once every serious step for a game is ticked", /st2 done( fresh)?"><span class="c">✓<\/span><span>Protect/.test($$("rail").innerHTML));
  check("the step that just lit up pops, steps that were already lit don't", /st2 done fresh"><span class="c">✓<\/span><span>Protect/.test($$("rail").innerHTML) && /st2 done"><span class="c">✓<\/span><span>Watch/.test($$("rail").innerHTML));
  check("the line between two finished steps turns green", /class="ln fill"/.test($$("rail").innerHTML));
  check("the mascot celebrates", $$("bubble").className === "bubble m-happy");
  await wait(650);
  check("ticked steps are remembered for this chat", (T.stored.bob.doneAll["https://chat.test/c/1"] || []).includes("https"));
  await click("copy", {}, "chk:secrets-hidden");
  check("Copy prompt gives a paste-ready prompt: goal, plain words, full code", /a game/.test(T.copied) && /simple words/.test(T.copied) && /environment variables/.test(T.copied) && /full changed code/.test(T.copied));

  console.log("Bob keeps watching while the panel is closed");
  hostEl.h["bob-esc"]();
  await T.rescan();
  check("high-severity code problems get their own heads-up", $$("toast").hidden === false && /Heads up: /.test($$("tt").textContent));
  await T.rescan();
  check("a second problem gets its own heads-up too", /Heads up: /.test($$("tt").textContent));
  PAGE.asst = ["Great idea. I'll add login with Supabase and a database for the scores."];
  await T.rescan();
  check("new things in the plan add steps, and Bob says so", /I also see login/.test($$("tt").textContent) && /safety step/.test($$("ts2").textContent));

  PAGE.user = ["I want to make a minecraft style game", "nvm I want a portfolio website"];
  await T.rescan();
  check("a change of plan is noticed", /changed plans: a game → a website/.test($$("tt").textContent));

  console.log("It still works when the site's labels change");
  PAGE.user = []; PAGE.asst = []; PAGE.pre = []; PAGE.text = "I am building an online shop with checkout and Stripe payments";
  await T.rescan();
  check("falls back to reading the page text (no crash)", /Watching this page/.test($$("st").textContent));
  check("still works out what is being built", /changed plans: a website → an online shop/.test($$("tt").textContent));
  await click("toastopen");
  await T.ensureList();
  html = $$("body").innerHTML;
  check("a shop gets shop-only steps", /Decide prices on the server/.test(html) && /Never touch card numbers yourself/.test(html));
  check("a shop does NOT get game steps", !/Keep scores and wins on the server/.test(html));

  console.log("Unsure -> asks, never guesses");
  PAGE.text = "hello can you help me";
  await T.rescan();
  html = $$("body").innerHTML;
  check("unclear text does not flip the plan (Bob keeps the last clear guess)", /You(&#39;|')re building <b>an online shop|You're building <b>an online shop/.test(html) || /What are you building\?/.test(html));
  await click("type", { type: "bot" });
  await T.ensureList();
  check("bot steps appear after tapping 'A bot'", /Guard your bot(&#39;|')s token like a password/.test($$("body").innerHTML));
  check("and the shop-only steps go away", !/Decide prices on the server/.test($$("body").innerHTML));

  console.log("Chat still works");
  await click("tab", { tab: "chat" });
  $$("input").value = "what is a loop?";
  await click("send");
  check("no key -> asks for it, does not call the model", calls.length === 0 && /free OpenRouter key/.test(T.msgsHtml()));
  $$("key").value = "sk-or-test-key-123456789";
  $$("input").value = "what is a loop?";
  const p = hostEl.h["bob-send"]();
  check("mascot is thinking while the AI answers", $$("bubble").className === "bubble m-thinking");
  check("a typing indicator shows while Bob waits for the answer", /class="typing"/.test(T.msgsHtml()));
  await p; await wait(20);
  check("model is called with the key, teacher prompt, no page text", calls.length === 1 && calls[0].key === "sk-or-test-key-123456789" && /10-year-old/.test(calls[0].messages[0].content) && !/Page text/.test(calls[0].messages[0].content));
  check("hidden <think> text never shows", /Hi there, friend/.test(T.msgsHtml()) && !/secret thoughts/.test(T.msgsHtml()));
  check("the typing indicator is replaced by the real answer", !/class="typing"/.test($$("msgs").children.slice(-1)[0]._q.innerHTML));
  await click("quick", { i: "0" }); await wait(20);
  check("quick chip sends page text and the log says so", calls.length === 2 && /Page text about loops/.test(calls[1].messages[0].content));

  await click("ask", {}, "chk:https"); await wait(20);
  check("'Ask Bob' on a checklist step goes to the chat", $$("panel").dataset.tab === "chat" && /Make sure your site uses HTTPS/.test(calls[calls.length - 1].messages.slice(-1)[0].content));

  console.log("Motion");
  await click("tab", { tab: "check" });
  check("cards rise in when you switch tabs", $$("body").classList._s.has("enter"));
  await wait(1000);
  check("...and the animation class is removed again so nothing replays on every update", !$$("body").classList._s.has("enter"));

  console.log("Resize and push");
  $$("grip").h.pointerdown({ clientX: 1000, pointerId: 1 });
  $$("grip").h.pointermove({ clientX: 900 });
  check("dragging the left edge makes the sidebar wider", $$("panel").style.width === "420px");
  $$("grip").h.pointermove({ clientX: -5000 });
  check("it can't grow past 90% of the screen", parseInt($$("panel").style.width) <= 1080);
  $$("grip").h.pointermove({ clientX: 5000 });
  check("or shrink below a usable width", $$("panel").style.width === "320px");
  $$("grip").h.pointermove({ clientX: 900 }); $$("grip").h.pointerup();
  check("the width is remembered", T.prefs.w === "420");
  await click("push");
  check("'Make room' pushes the page over by the sidebar's width", global.document.documentElement.style.marginRight === "420px");
  await click("close");
  check("collapsing gives the page its room back and brings the bubble back", global.document.documentElement.style.marginRight === "" && $$("bubble").style.display === "");
  await $$("bubble").h.click();
  check("clicking the bubble reopens the sidebar", $$("panel").classList._s.has("open") && $$("bubble").style.display === "none");

  console.log("After an extension update");
  global.__stale = true;
  await T.rescan();
  check("a tab left open across an update says 'refresh' instead of crashing", /Refresh this page/.test($$("st").textContent) && $$("sync").textContent === "REFRESH");
  await click("tab", { tab: "chat" });
  $$("input").value = "hello"; await hostEl.h["bob-send"](); await wait(20);
  check("chat explains what to do in plain words", /just updated/.test(T.msgsHtml()) && /refresh the page/i.test(T.msgsHtml()));
  global.__stale = false; await T.rescan();
  check("after a refresh-free recovery Bob is watching again", /Watching/.test($$("st").textContent));
  await click("tab", { tab: "check" });

  console.log("Pause and delete");
  await click("tab", { tab: "check" });
  await click("pause");
  check("paused: header says Paused", $$("st").textContent === "Paused" && $$("sync").textContent === "PAUSED");
  await click("resume");
  await click("details");
  check("details show what was sent and the checklist size", /Chat message to OpenRouter/.test($$("body").innerHTML) && /safety checklist \(\d+ steps/.test($$("body").innerHTML));
  await click("delete");
  check("first delete tap asks to confirm", /Tap again/.test($$("body").innerHTML));
  await click("delete");
  check("delete wipes everything and returns to the consent card", T.stored.bob === undefined && T.prefs.key === undefined && /Yes, watch along/.test($$("body").innerHTML));
  T.finish();
})();
