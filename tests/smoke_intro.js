// First run: Bob has not been allowed yet. Run: node smoke_intro.js
const T = require("./harness.js")({ stored: {}, page: { user: ["make me a website"], pre: [] } });
const { $$, wait, click, check } = T;
(async () => {
  await wait(300);
  check("before consent Bob stays quiet (no pop-up yet, nothing read)", $$("toast").hidden !== false && !T.hostEl.read);
  check("status is Off before consent", $$("sync").textContent === "OFF");
  await wait(1500);
  check("Bob introduces himself once, politely", $$("toast").hidden === false && /Hi! I'm Bob/.test($$("tt").textContent));
  await wait(650);
  check("the intro is only shown once (remembered)", T.stored.bob && T.stored.bob.introSeen === true);
  await click("toastopen");
  check("tapping it shows the one-time consent card in plain words", /Want me to watch along/.test($$("body").innerHTML) && /What I never do/.test($$("body").innerHTML) && /parent or guardian/.test($$("body").innerHTML));
  check("consent card says where data goes", /nowhere/.test($$("body").innerHTML));
  check("no checklist or guesses before consent", !/Safety checklist/.test($$("body").innerHTML) && !/You're building/.test($$("body").innerHTML));
  await click("enable"); await wait(700);
  check("after 'Yes' Bob starts watching", $$("sync").textContent === "WATCHING" || /Watching/.test($$("st").textContent));
  await wait(650);
  check("consent is remembered for all chat sites", T.stored.bob.consentAll === true);
  check("Bob now knows it is a website", /You're building <b>a website<\/b>/.test($$("body").innerHTML));
  T.finish();
})();
