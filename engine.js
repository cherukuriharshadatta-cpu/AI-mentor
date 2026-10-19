/*!
 * engine.js - Bob's brain. Rule-based (free, fast, no network). Works in the browser
 * (window.BobEngine) and in Node (require) so it can be tested.
 * Every lesson is DATA written once; nothing here is invented at run time.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BobEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const OWASP = "https://owasp.org/www-project-top-ten/";
  const REVIEWED = "2026-10-18";
  const SEV_ORDER = { high: 0, medium: 1, low: 2 };

  // ---------------------------------------------------------------- masking
  const SECRET_TOKEN_RE = /\b(?:sk-or-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/g;
  const KEYVAL_RE = /((?:api[_-]?key|secret|token|passw(?:or)?d|pwd)["']?\s*[:=]\s*)(["'])([^"'\n]+)\2/gi;
  const BEARER_RE = /(Bearer\s+)[A-Za-z0-9._~+\/-]{10,}/g;

  function maskSecret(v) {
    v = String(v);
    return v.length <= 4 ? "\u2022\u2022\u2022\u2022" : v.slice(0, 3) + "\u2022\u2022\u2022\u2022";
  }
  // Never returns a full secret.
  function maskLine(line) {
    let s = String(line).replace(SECRET_TOKEN_RE, (m) => maskSecret(m));
    s = s.replace(KEYVAL_RE, (m, k, q, v) => k + q + maskSecret(v) + q);
    s = s.replace(BEARER_RE, (m, b) => b + "\u2022\u2022\u2022\u2022");
    return s.trim().slice(0, 160);
  }

  // ------------------------------------------------------------ rule helpers
  const lineHits = (re, extra) => (code, lines) => {
    const out = [];
    lines.forEach((t, i) => { if (re.test(t) && (!extra || extra(t))) out.push({ line: i + 1, text: t }); });
    return out;
  };
  const anyLine = (res, extra) => (code, lines) => {
    const out = [];
    lines.forEach((t, i) => { if (res.some((r) => r.test(t)) && (!extra || extra(t))) out.push({ line: i + 1, text: t }); });
    return out;
  };
  const firstLine = (lines, re) => {
    const i = lines.findIndex((t) => re.test(t));
    return i < 0 ? [] : [{ line: i + 1, text: lines[i] }];
  };

  const PASSWORD = /passw(or)?d/i;
  const STORES = /(INSERT\s+INTO|\.insert\(|\.save\(|\.create\(|users?\.push\(|\.set\(|\bdb\.|\.add\(|writeFile|setItem)/i;
  const HASHED = /(bcrypt|argon2|scrypt|pbkdf2|hashpw|generate_password_hash|make_password|passlib|hash(ed)?[_ ]?password|hashSync|\.hash\()/i;

  const R = (id, title, severity, kind, find, why, analogy, fix) =>
    ({ id, title, severity, kind, find, why, analogy, fix, source: kind === "security" ? OWASP : null, lastReviewed: REVIEWED });

  const RULES = [
    R("hardcoded-secret", "A secret key is written in your code", "high", "security",
      anyLine([/\b(?:sk-or-[A-Za-z0-9_-]{16,}|sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/,
        /(api[_-]?key|secret|token|passw(or)?d|pwd)["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
        (t) => !/(your[-_ ]?\w*[-_ ]?(key|token|secret)|example|placeholder|x{4,}|<[^>]+>)/i.test(t) || /\b(?:sk-|AIza|ghp_|AKIA|xox)/.test(t)),
      "Anyone who can see this code can copy the key and use your account, often with your money.",
      "It's like taping your house key to the front door.",
      "Move the key out of the code into a hidden setting (an environment variable). Then make a NEW key, because this one has already been seen."),
    R("plain-password", "Passwords are saved as plain text", "high", "security",
      (code, lines) => {
        if (!PASSWORD.test(code) || !STORES.test(code) || HASHED.test(code)) return [];
        const both = lines.findIndex((t) => PASSWORD.test(t) && STORES.test(t));
        const any = lines.findIndex((t) => PASSWORD.test(t));
        const i = both >= 0 ? both : any;
        return i < 0 ? [] : [{ line: i + 1, text: lines[i] }];
      },
      "If someone sneaks into your database, they can read everyone's password. People reuse passwords, so it hurts them on other sites too.",
      "It's like leaving everyone's diary open on a table. Scrambling (\"hashing\") a password is like turning a banana into a smoothie that can't be turned back.",
      "Hash every password with bcrypt or argon2 before saving it. When someone logs in, hash what they typed and compare the two scrambled versions."),
    R("weak-hash", "Passwords are scrambled with an old, weak method", "high", "security",
      (code, lines) => (PASSWORD.test(code) ? lineHits(/\b(md5|sha1)\b/i)(code, lines) : []),
      "MD5 and SHA1 are very fast, so attackers can guess billions of passwords every second.",
      "It's a lock that opens with a paperclip.",
      "Use bcrypt or argon2 instead of md5 or sha1 for passwords."),
    R("xss", "Page content is built from raw text (XSS risk)", "high", "security",
      lineHits(/(\.innerHTML\s*=|\.outerHTML\s*=|dangerouslySetInnerHTML|document\.write\()/),
      "If a stranger can type something that becomes part of your page, they can sneak in code that runs on other people's screens.",
      "It's like letting visitors write notes that your robot reads out loud as orders.",
      "Show user text with textContent (or your framework's normal safe way) instead of innerHTML. If you must show HTML, clean it first with a trusted tool like DOMPurify."),
    R("eval", "Text is being run as code (eval)", "high", "security",
      lineHits(/(\beval\s*\(|new\s+Function\s*\()/),
      "If any part of that text comes from a user, they can make your app run their commands.",
      "It's like obeying any note someone slips under your door.",
      "Remove eval and new Function. Use safe parsing instead, for example JSON.parse for data."),
    R("sql-injection", "A database question is glued together from user text", "high", "security",
      anyLine([/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^\n]*(["'`]\s*\+\s*[\w(]|\$\{[^}]+\}|["']\s*%\s*\(?\w|\.format\()/i,
        /\bf["'`]\s*(SELECT|INSERT|UPDATE|DELETE)\b[^\n]*\{/i]),
      "A stranger can type tricky text that changes your database question, then read or delete everything.",
      "It's like a form where someone writes \"and also hand me everyone's files\" and the clerk obeys.",
      "Use parameterized queries (placeholders like ?) so user text is only ever treated as data, never as part of the question."),
    R("cors-open", "Any website is allowed to talk to your server", "medium", "security",
      lineHits(/(Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|allow_origins\s*=\s*\[\s*["']\*["']|origin\s*:\s*["']\*["']|\bcors\(\s*\)|CORS\(\s*app\s*\))/i),
      "Your server accepts requests from every website on the internet, even bad ones.",
      "It's a front desk that lets in anyone who says \"I'm a friend\".",
      "Allow only your own website address in CORS. List the exact addresses."),
    R("jwt-weak", "The login-ticket secret is weak or written in the code", "high", "security",
      anyLine([/jwt\.(sign|encode)\([^\n]*["'](secret|password|changeme|123456|jwtsecret|mysecret|supersecret|your[-_]?secret)["']/i,
        /(JWT_SECRET|jwtSecret|SECRET_KEY)\s*[:=]\s*["'][^"'\n]{0,15}["']/i]),
      "With that secret, someone can print fake login tickets and pretend to be anyone, even an admin.",
      "It's like a stamp that anyone can copy to forge tickets.",
      "Use a long random secret from a hidden setting (never written in the code), and make login tickets expire."),
    R("debug-on", "Debug mode is switched on", "medium", "security",
      lineHits(/(\bdebug\s*=\s*True\b|\bDEBUG\s*=\s*True\b)/),
      "Debug mode can show private details to visitors and sometimes lets them run code.",
      "It's like leaving the workshop door open with the blueprints on the table.",
      "Turn debug off for the real website, and read that choice from a setting."),
    R("default-creds", "A simple login like admin/admin is used", "high", "security",
      lineHits(/(["'](admin|root)["']\s*[,:]\s*["'](admin|password|123456|1234|root)["']|\bpassword\s*[:=]\s*["'](admin|password|123456|12345678|1234|root)["'])/i),
      "Simple passwords are the first thing strangers try.",
      "It's like a lock whose code is 1234.",
      "Remove default logins. Make the first admin choose a strong password, and keep it out of the code."),
    R("ssl-off", "Safety checks on connections are switched off", "high", "security",
      lineHits(/(verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/i),
      "Without the check, someone in the middle (for example on public Wi-Fi) can read or change what your app sends.",
      "It's like accepting a letter without checking the stamp or who sent it.",
      "Turn certificate checking back on (verify=True, or remove rejectUnauthorized: false)."),
    R("token-local", "The login ticket is kept in localStorage", "medium", "security",
      lineHits(/localStorage\.setItem\(\s*["'][^"']*(token|jwt|session|auth)[^"']*["']/i),
      "Any bad script on the page can read localStorage and steal the ticket.",
      "It's like wearing your ticket on the outside of your jacket.",
      "Use secure, HttpOnly cookies for login tickets, or your login service's built-in session handling."),
    R("random-token", "Math.random is used for something secret", "medium", "security",
      lineHits(/Math\.random\(\)/, (t) => /(token|session|reset|otp|secret|password)/i.test(t)),
      "Math.random can be guessed, so reset links or codes made with it could be guessed too.",
      "It's like choosing a \"secret\" number by counting in order.",
      "Use crypto.randomUUID() or crypto.getRandomValues() (secrets.token_urlsafe in Python)."),
    R("log-secrets", "Secrets may be printed in logs", "medium", "security",
      lineHits(/(console\.log|print|logger\.\w+|logging\.\w+)\([^\n]*(password|token|secret|api[_-]?key)/i),
      "Logs get copied around and read by many people.",
      "It's like saying your password out loud on a loudspeaker.",
      "Remove logging of passwords, tokens and keys. Log only safe things, like a user id."),
    R("paid-in-browser", "\"Paid\" status is kept in the browser", "high", "security",
      lineHits(/localStorage\.(set|get)Item\(\s*["'](paid|premium|isPro|isPaid|subscribed)["']/i),
      "Anyone can open the browser tools and change \"paid\" to true.",
      "It's like a bouncer who believes a sticker you wrote yourself.",
      "Check payment on the server, using your payment service's confirmed records, before unlocking anything."),
    R("public-env-secret", "A secret is stored in a setting that goes to the browser", "high", "security",
      lineHits(/\b(NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_)[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|ADMIN|PASSWORD)[A-Z0-9_]*/),
      "Settings that start with NEXT_PUBLIC_, VITE_, REACT_APP_ or EXPO_PUBLIC_ are sent to everyone who opens your site.",
      "It's like writing your PIN on the poster in your shop window.",
      "Move it to a server-only setting and use it only in server code."),
    R("unsigned-webhook", "Payment messages are not checked", "high", "security",
      (code, lines) => (/webhook/i.test(code) && /(stripe|razorpay|paypal)/i.test(code) && !/(constructEvent|construct_event|signature|hmac|verify)/i.test(code)
        ? firstLine(lines, /webhook/i) : []),
      "Without a check, anyone can send a fake \"payment done\" message to your app.",
      "It's like accepting a \"paid\" note without checking it really came from the bank.",
      "Verify the webhook signature with your payment service's own library before trusting the message."),
    R("upload-unchecked", "File uploads are not limited", "medium", "security",
      (code, lines) => (/(multer\s*\(|request\.files|req\.files|upload\.(single|array)\()/.test(code)
        && !/(fileFilter|mimetype|content_type|allowed_extensions|secure_filename|limits\s*:|MAX_CONTENT_LENGTH|file\.size|\.size\s*>)/i.test(code)
        ? firstLine(lines, /(multer\s*\(|request\.files|req\.files|upload\.(single|array)\()/) : []),
      "People could upload huge files, or dangerous ones, and fill your storage or attack your server.",
      "It's like a mailbox that accepts any package of any size.",
      "Limit the file size, allow only the types you need, rename uploaded files, and never run an uploaded file."),
    R("login-no-limit", "Login has no \"too many tries\" limit", "medium", "production",
      (code, lines) => (/["'`]\/(login|signin|auth\/login)["'`]|\bdef\s+login\b/i.test(code)
        && !/(rate.?limit|throttle|slowapi|flask_limiter)/i.test(code)
        ? firstLine(lines, /["'`]\/(login|signin|auth\/login)["'`]|\bdef\s+login\b/i) : []),
      "Someone can try millions of passwords, one after another.",
      "It's like a safe that lets you guess the code forever.",
      "Add a rate limit to login (for example 5 tries, then wait) and do the same for password reset."),
    R("fetch-no-catch", "Requests can fail with no plan for it", "low", "production",
      (code, lines) => (/\b(fetch|axios)\s*[.(]/.test(code) && !/(\bcatch\b|\.catch\(|\btry\s*[{:])/.test(code)
        ? firstLine(lines, /\b(fetch|axios)\s*[.(]/) : []),
      "The internet breaks sometimes. With no plan, the screen goes blank or hangs.",
      "It's like a shop with no sign for \"we're closed\".",
      "Wrap requests in try/catch, show a friendly error and a loading state, and add a timeout."),
    R("select-star", "Asking the database for everything at once", "low", "production",
      lineHits(/SELECT\s+\*\s+FROM/i, (t) => !/LIMIT|WHERE\s+\w*id\s*=/i.test(t)),
      "It's fine with 10 rows. With 100,000 rows the app gets slow.",
      "It's like carrying the whole library home to read one book.",
      "Ask only for the columns you need, add LIMIT and paging, and add an index on columns you search."),
  ];

  function scanCode(code) {
    code = String(code || "");
    const lines = code.split(/\r?\n/);
    const out = [];
    for (const r of RULES) {
      let hits;
      try { hits = r.find(code, lines); } catch (e) { hits = []; }
      if (hits && hits.length) {
        out.push({
          id: r.id, title: r.title, severity: r.severity, kind: r.kind,
          why: r.why, analogy: r.analogy, fix: r.fix, source: r.source, lastReviewed: r.lastReviewed,
          evidence: maskLine(hits[0].text), line: hits[0].line, count: hits.length,
        });
      }
    }
    return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  }
  const checkedCount = () => RULES.length;

  // ------------------------------------------------------- prove it (re-check)
  // prev: {ruleId: "open"|"fixed"|"unverified"}; currentIds: Set of rules found now.
  // "fixed" only when the evidence is gone AND we could actually look at code.
  function reconcile(prev, currentIds, haveCode) {
    const next = {};
    for (const id of currentIds) next[id] = "open";
    for (const id of Object.keys(prev || {})) {
      if (currentIds.has(id)) continue;
      if (prev[id] === "open") next[id] = haveCode ? "fixed" : "unverified";
      else next[id] = prev[id];
    }
    return next;
  }

  // ------------------------------------------------------- what are they making
  const PROJECT_TYPES = [
    { type: "game", label: "a game", re: /\b(game|minecraft|roblox|unity|platformer|multiplayer|fortnite|godot)\b/gi },
    { type: "website", label: "a website", re: /\b(web ?site|landing page|portfolio|blog|web ?app|web ?page|html)\b/gi },
    { type: "mobile", label: "a phone app", re: /\b(android|ios|iphone|mobile app|phone app|flutter|react native|apk)\b/gi },
    { type: "bot", label: "a bot", re: /\b(chat ?bot|discord bot|telegram bot|whatsapp bot|ai agent|bot)\b/gi },
    { type: "store", label: "an online shop", re: /\b(online (shop|store)|e-?commerce|checkout|shopping cart|sell (products|things|stuff))\b/gi },
    { type: "backend", label: "a backend (the hidden part of an app)", re: /\b(api|backend|back-end|server|endpoints?)\b/gi },
  ];
  // userTexts: oldest -> newest. Newer messages count more (people change their mind).
  function detectProject(userTexts) {
    const scores = PROJECT_TYPES.map((p) => ({ type: p.type, label: p.label, score: 0 }));
    (userTexts || []).forEach((t, i) => {
      PROJECT_TYPES.forEach((p, k) => {
        const m = String(t).match(p.re);
        if (m) scores[k].score += m.length * (i + 1);
      });
    });
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0], second = scores[1];
    if (!top || top.score === 0) return { type: "unknown", label: "an app", confidence: 0, candidates: [] };
    return {
      type: top.type, label: top.label,
      confidence: top.score / (top.score + second.score + 0.5),
      candidates: scores.filter((s) => s.score > 0).map((s) => s.type),
    };
  }

  // ------------------------------------------------------------------ prompts
  function buildPrompt({ goal, change, evidence, constraints }) {
    const lines = [
      `I'm building ${goal || "an app"}. I'm new to coding, so please keep it simple.`,
      "",
      `What I need: ${change}`,
    ];
    if (evidence) lines.push(`I noticed this in the code (secrets hidden): ${evidence}`);
    lines.push("", "Please:");
    (constraints || []).forEach((c) => lines.push("- " + c));
    lines.push(
      "- Explain what you changed in simple words, like I'm 10.",
      "- Show me the full changed code.",
      "- Tell me how I can check that it worked."
    );
    return lines.join("\n");
  }
  const findingPrompt = (f, goal) => buildPrompt({
    goal, change: f.fix, evidence: f.evidence,
    constraints: ["Change only what is needed. Don't remove my other features.", "Never put real secret keys in the code or in this chat."],
  });

  // -------------------------------------------------------------------- needs
  const opt = (id, name, what, gives, difficulty, best, notWhen, url) => ({ id, name, what, gives, difficulty, best, notWhen, url });
  const NEEDS = {
    hosting: {
      title: "A place to put it online (hosting)",
      plain: "Right now your project only lives on your computer. Hosting puts it on the internet so other people can open it.",
      analogy: "Like opening a shop on a street so people can walk in, instead of keeping the shop in your bedroom.",
      options: [
        opt("vercel", "Vercel", "Puts websites online from your code in a few clicks.", "A web address anyone can open. It updates when you update your code.", "Easy", "websites and web apps", "Not made for programs that must stay switched on all day, like bots.", "https://vercel.com"),
        opt("netlify", "Netlify", "Another easy way to put simple websites online.", "A web address anyone can open.", "Easy", "simple websites", "Similar to Vercel, so no big reason to pick it unless you already like it.", "https://www.netlify.com"),
        opt("render", "Render", "Runs programs that must stay on, like servers, bots and APIs.", "A computer in the cloud that keeps your program running.", "Medium", "bots, backends, game servers", "A bit more to learn than Vercel for a plain website.", "https://render.com"),
      ],
      pick: { default: "vercel", byType: { bot: "render", backend: "render", game: "render" },
        because: { vercel: "your project is mostly web pages, and this is the quickest way to share one.", render: "your project has a part that must keep running, and this is made for that." } },
      change: "Help me choose where to put my project online and publish it using {pick}. Give me step-by-step instructions I can follow, and tell me what I must NOT put online (like secret keys).",
    },
    database: {
      title: "A place to keep information (database)",
      plain: "Your app needs to remember things, like scores, names or messages, even after the page is closed.",
      analogy: "A database is a filing cabinet that never forgets, and only opens for people with the key.",
      options: [
        opt("supabase", "Supabase", "A ready-made database with login built in.", "Tables to store things, plus accounts, in one place.", "Medium", "websites, shops and backends", "A little more to learn at the start than Firebase.", "https://supabase.com"),
        opt("firebase", "Firebase", "Google's ready-made database and login for apps.", "Easy saving of data and users, great for phone apps.", "Easy", "phone apps and quick projects", "Its way of storing data feels different from normal tables, which can confuse you later.", "https://firebase.google.com"),
        opt("sqlite", "SQLite", "A tiny database that lives in one file.", "Saving data with no account and no setup.", "Easy", "practice projects used by one person", "Not good once many people use your app at the same time.", "https://www.sqlite.org"),
      ],
      pick: { default: "supabase", byType: { mobile: "firebase" },
        because: { supabase: "it gives you a database and safe login together, so there is less to set up.", firebase: "it works very smoothly with phone apps and is quick to start." } },
      change: "Help me add a database to my project using {pick}. Show me what information I need to save, set up the tables or collections, and keep every user's data private to them.",
    },
    login: {
      title: "A safe way to log in (accounts)",
      plain: "If people have accounts, your app must check who is who. Writing your own login is very easy to get wrong.",
      analogy: "Like a security guard checking name tags at the door. Hire a trained guard. Don't be your own.",
      options: [
        opt("builtin", "Built-in login from your database service", "Supabase and Firebase both include login.", "Sign-up, log-in and password reset already done safely.", "Easy", "almost every project", "None really. It's the simplest path if you already use one of them.", "https://supabase.com"),
        opt("clerk", "Clerk", "A service that only does login, with ready-made screens.", "Nice sign-in pages and user management.", "Easy", "websites that want polished login quickly", "One more account and service to manage.", "https://clerk.com"),
        opt("auth0", "Auth0", "A big, well-known login service.", "Many ways to sign in and lots of controls.", "Medium", "bigger projects", "More settings than a beginner needs.", "https://auth0.com"),
      ],
      pick: { default: "builtin", byType: {}, because: { builtin: "it comes with the database you picked, so there is one less thing to set up." } },
      change: "Help me add safe login to my project using the built-in login of my database service. Don't write my own password code. Make sure each person can only see their own data.",
    },
    payments: {
      title: "Taking payments safely",
      plain: "To get paid, use a payment company. Never handle card numbers yourself.",
      analogy: "Like letting the bank's cashier handle the money while you hand over the goods.",
      note: "Payment services need an adult to set up the account. If you're under 18, ask a parent or guardian. Never type real card numbers into your code.",
      options: [
        opt("stripe", "Stripe", "A very popular way to take card payments online.", "Safe checkout pages and a test mode with pretend money.", "Medium", "shops and subscriptions", "Not available in every country, so check yours first.", "https://stripe.com"),
        opt("razorpay", "Razorpay", "A payment service popular in India.", "Checkout for cards and local payment methods, with a test mode.", "Medium", "projects with customers in India", "Check that it works for the countries your customers live in.", "https://razorpay.com"),
      ],
      pick: { default: "stripe", byType: {}, because: { stripe: "it's widely used, and its test mode lets you practice with pretend money. Check it works in your country." } },
      change: "Help me add payments using {pick} in TEST mode only. The server must confirm each payment (never the browser), verify webhook signatures, and prevent double charges.",
    },
    secrets: {
      title: "A hiding place for secret keys",
      plain: "Secret keys are passwords for services. They must never be in your code or on the web page. Anyone could copy them and spend your money.",
      analogy: "A key is like your house key. You keep it in your pocket, not taped to the front door.",
      options: [
        opt("hostenv", "Secret settings on your hosting site", "A private settings page where you type your keys once.", "Keys that your app can use but visitors can't see.", "Easy", "when your project is online", "Doesn't help while you're still testing on your own computer.", null),
        opt("envfile", "A local .env file (kept out of Git)", "A private file on your computer that holds your keys.", "Keys for testing on your own computer.", "Easy", "testing on your own computer", "Never upload this file anywhere. It must stay on your computer.", null),
      ],
      pick: { default: "hostenv", byType: {}, because: { hostenv: "it's where the keys are safest once your project is online. Use a .env file only for testing at home." } },
      change: "Help me move all my secret keys out of my code into environment variables. Show me how to set them on my computer (a .env file that Git ignores) and on my hosting site. Check that no key is sent to the browser.",
    },
    limits: {
      title: "Spending and usage limits",
      plain: "If your app uses a paid service, a bug or a bad person could use it thousands of times and send you a big bill.",
      analogy: "Like a prepaid phone card. When it runs out, calls stop, instead of a giant bill at the end of the month.",
      options: [
        opt("budget", "Budget alerts and caps in your accounts", "Settings inside each service where you set a maximum.", "A warning email, or a hard stop, before money runs away.", "Easy", "every paid service you use", "Some services only warn you and don't stop, so read what each one does.", null),
        opt("ratelimit", "Rate limits in your own code", "A small library that says \"slow down\" to anyone who asks too often.", "Protection even if someone attacks your app.", "Medium", "apps with login or paid features", "A bit of code to add and test.", "https://www.npmjs.com/package/express-rate-limit"),
      ],
      pick: { default: "budget", byType: {}, because: { budget: "it takes five minutes and protects your wallet right away." } },
      change: "Help me add usage limits: tell me how to set a budget alert or cap in the services I use, and add rate limiting to my login and any route that costs money.",
    },
    backups: {
      title: "Backups (a spare copy)",
      plain: "If your data gets deleted or broken, you need a spare copy. And you must test that the spare copy really works.",
      analogy: "Like photocopying your homework. It's no use if the copy is blank, so check it.",
      options: [
        opt("auto", "Automatic backups from your database service", "Many database services can save copies for you.", "Spare copies made on a schedule.", "Easy", "almost every project", "What's included depends on your plan, so check what you get.", null),
        opt("manual", "Export a copy yourself", "Download your data every so often.", "A file you control and can keep anywhere.", "Easy", "small projects", "You have to remember to do it.", null),
      ],
      pick: { default: "auto", byType: {}, because: { auto: "you don't have to remember to do it. Then try restoring one copy to be sure it works." } },
      change: "Help me turn on backups for my database and show me how to test restoring one, so I know it really works.",
    },
  };
  const TYPE_NEEDS = {
    game: ["hosting", "database", "login", "secrets", "limits", "backups"],
    website: ["hosting", "database", "login", "secrets", "backups"],
    mobile: ["database", "login", "secrets", "limits", "backups"],
    bot: ["hosting", "secrets", "limits", "database"],
    store: ["hosting", "database", "login", "payments", "secrets", "limits", "backups"],
    backend: ["hosting", "database", "login", "secrets", "limits", "backups"],
  };

  function planNeeds(type, learned) {
    learned = learned || new Set();
    return (TYPE_NEEDS[type] || [])
      .filter((id) => !learned.has("need:" + id))
      .map((id) => {
        const n = NEEDS[id];
        const pid = (n.pick.byType && n.pick.byType[type]) || n.pick.default;
        const o = n.options.find((x) => x.id === pid);
        return Object.assign({ id }, n, {
          pick: { id: pid, name: o.name, because: n.pick.because[pid] },
          costNote: "Prices and free limits change and I don't remember them. Check the website. Last checked: not yet.",
          lastReviewed: REVIEWED,
        });
      });
  }
  const needPrompt = (n, goal) => buildPrompt({
    goal, change: n.change.replace("{pick}", n.pick.name),
    constraints: ["Use the free option if there is one, and tell me clearly if something costs money.", "Never ask me to paste secret keys into this chat."],
  });

  // ------------------------------------------- features Bob notices in the plan
  const FEATURES = [
    { id: "login", label: "login / accounts", re: /\b(log ?in|sign ?(in|up)|accounts?|authentication|user registration|register(ed)? users?)\b/i },
    { id: "database", label: "a database", re: /\b(database|sqlite|postgres(ql)?|mysql|mongo(db)?|supabase|firebase|firestore|prisma|save (the )?(data|users|scores)|store (the )?(data|users|scores))\b/i },
    { id: "payments", label: "payments", re: /\b(payments?|checkout|stripe|razorpay|paypal|subscriptions?|credit cards?|in-app purchases?|paid plan)\b/i },
    { id: "uploads", label: "file uploads", re: /\b(uploads?|uploading|profile (pic|picture|photo)|attachments?)\b/i },
    { id: "keys", label: "API keys", re: /\b(api[ _-]?keys?|secret keys?|access tokens?|\.env|environment variables?|webhooks?)\b/i },
    { id: "ai", label: "an AI feature", re: /\b(openai|gpt-?\d?|anthropic|claude api|gemini api|openrouter|llm|ai (feature|assistant|agent|chat)|chatbot)\b/i },
    { id: "user-content", label: "posts or comments from visitors", re: /\b(comments?|comment section|forum|reviews|contact form|guest ?book|user[- ]generated|chat ?room|direct messages)\b/i },
    { id: "multiplayer", label: "online play", re: /\b(multiplayer|websockets?|socket\.io|real-?time|online play|leaderboards?)\b/i },
    { id: "email", label: "sending emails", re: /\b(send(ing)? emails?|newsletter|email verification|reset (your )?password|smtp|sendgrid)\b/i },
    { id: "kids", label: "an app for kids", re: /\b(for kids|for children|children'?s app|kids'? app|kid[- ]friendly)\b/i },
    { id: "admin", label: "an admin area", re: /\b(admin (panel|dashboard|page|area)|moderator)\b/i },
    { id: "personal-data", label: "personal information", re: /\b(personal (data|info(rmation)?)|home addresses|phone numbers?|email addresses|customer data|health data|location data)\b/i },
  ];
  const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.id, f.label]));
  function detectFeatures(texts) {
    const t = (texts || []).join("\n");
    return FEATURES.filter((f) => f.re.test(t)).map((f) => f.id);
  }

  // ------------------------------------------------------------- roadmaps
  const ROADMAPS = {
    website: ["Plan the pages you want", "Build them with your AI helper", "Pick a place to put it online", "Do the safety steps below", "Test it with a friend, then share it"],
    game: ["Decide what the game is about", "Build one small level first", "Add saving, scores or accounts only if you need them", "Do the safety steps below", "Test with friends, then share it"],
    mobile: ["Decide what the app should do", "Build one screen at a time", "Choose where its data will live", "Do the safety steps below", "Test on a real phone, then share it"],
    bot: ["Decide what the bot should do", "Build one command at a time", "Pick a place where it can stay switched on", "Do the safety steps below", "Test in a private place first"],
    store: ["List what you want to sell", "Build the shop pages", "Add safe payments (test mode first)", "Do the safety steps below", "Try a pretend order, then open the shop"],
    backend: ["Decide what the API should do", "Build one route at a time", "Pick where it runs and where its data lives", "Do the safety steps below", "Test with fake data, then connect your app"],
  };

  // --------------------------------------------------- the safety checklist
  // when: {all:true} | {type:[...]} | {feature:[...]}   (type OR feature match shows it)
  const K = (id, title, severity, when, why, analogy, todo) =>
    ({ id, title, severity, when, why, analogy, todo, source: OWASP, lastReviewed: REVIEWED });
  const ALL = { all: true };
  const CHECKS = [
    // ---- every project that goes online
    K("https", "Make sure your site uses HTTPS (the padlock)", "high", ALL,
      "Without HTTPS, anyone on the same Wi-Fi can read or change what your visitors send.",
      "It's like sending a postcard instead of a sealed letter.",
      "Make sure my project only works over HTTPS (the padlock), and send anyone who opens a plain http:// address to the https:// one. Tell me where to check this on my hosting site."),
    K("secrets-hidden", "Keep every secret key out of your code and out of the browser", "high", ALL,
      "A leaked key lets strangers use your accounts and spend your money.",
      "It's like taping your house key to the front door.",
      "Find every secret key, password or token in my project and move it into environment variables on the server. Make sure none of them is sent to the browser. Tell me which ones I must replace because they were visible."),
    K("env-ignored", "Keep your .env file out of GitHub", "high", ALL,
      "Bots scan GitHub all day for keys. A leaked key can be used within minutes.",
      "It's like leaving your diary on a park bench with a sign saying \"free to read\".",
      "Add .env and other secret files to .gitignore, check that nothing secret is already saved in my Git history, and if something is, show me how to make new keys and clean it up."),
    K("validate-input", "Never trust what people type", "high", ALL,
      "Anyone can send your app anything: giant text, strange symbols, or commands in disguise.",
      "It's like a bouncer who checks every guest, not only the ones who look suspicious.",
      "Check every piece of information that comes into my app on the SERVER (not only in the browser): its type, length and allowed characters. Reject anything that doesn't fit."),
    K("hide-errors", "Don't show scary error details to visitors", "medium", ALL,
      "Error messages can reveal file names, passwords or how your app works, which helps attackers.",
      "It's like a shop clerk reading out the safe's combination when something goes wrong.",
      "Show visitors a short, friendly error message. Keep the technical details only in private logs that never include passwords, tokens or personal information."),
    K("least-access", "Give each key and each person only the access they need", "medium", ALL,
      "If a small key leaks, the damage stays small.",
      "It's like a school key that opens only your classroom, not the whole building.",
      "Check every key, account and database user in my project and give each one only the smallest permissions it needs (for example read-only where possible)."),
    K("backups-test", "Make backups, and test that you can restore one", "medium", ALL,
      "Mistakes and attacks happen. A backup you never tested may turn out to be empty.",
      "It's like photocopying homework: check that the copy isn't blank.",
      "Turn on automatic backups for my data, and show me step by step how to restore one into a test copy to prove it works."),
    K("updates", "Keep your tools and libraries up to date", "medium", ALL,
      "Old libraries often have known holes that attackers look for.",
      "It's like fixing a lock after everyone has learned how to pick it.",
      "Check my project's libraries for known security problems and old versions (for example with npm audit or pip-audit), update them safely, and tell me what changed."),
    K("test-fake", "Practice with pretend data first", "low", ALL,
      "While you're learning, mistakes with real people's data or real money cost a lot.",
      "It's like practising a fire drill with a toy, not a real fire.",
      "Set my project up so I can test with fake data and test modes (like pretend payments), and show me how to switch to the real thing only when I'm ready."),
    K("ai-review", "Ask your AI to do a safety review", "low", ALL,
      "AI helpers often build the app first and skip safety. Asking directly makes them look.",
      "It's like asking a friend to double-check your homework.",
      "Do a security review of all the code in this project. List the problems from most to least serious, explain each one in simple words, and fix the most serious ones first. Show me the changed code."),
    // ---- websites
    K("security-headers", "Add safety headers (including CSP)", "medium", { type: ["website"] },
      "These tell the browser what your page may load and do, which blocks lots of tricks.",
      "It's like house rules posted at the door.",
      "Add the standard security headers to my website: Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, and protection against being shown inside someone else's page (frame-ancestors). Explain each one in simple words."),
    K("trusted-scripts", "Only load scripts you trust", "medium", { type: ["website"] },
      "A script from another website runs with full power on your page. If that website is hacked, so is yours.",
      "It's like letting a stranger's helper into your classroom.",
      "List every outside script and stylesheet my pages load. Remove the ones I don't need, pin exact versions, and add integrity checks (SRI) where possible."),
    K("privacy-page", "Tell visitors what you collect", "low", { type: ["website"] },
      "People deserve to know what you save about them, and many places have rules about it.",
      "It's like the label on food that says what's inside.",
      "Write a short, plain-words privacy page that says what my site collects and why. Add a cookie notice only if I really use cookies. (I will ask a parent, guardian or expert to check it.)"),
    // ---- games
    K("server-truth", "Keep scores and wins on the server, not on the player's computer", "high", { type: ["game"] },
      "If your game has scores, coins or a leaderboard: anything on the player's computer can be changed, so cheaters can give themselves a million points.",
      "It's like letting players keep their own scoreboard.",
      "Move the real scores, coins and wins to my server. The player's game should only send actions (like \"jumped\"). The server decides what happened and checks it was possible."),
    K("chat-safety", "Protect players in chat and names", "high", { feature: ["multiplayer"] },
      "Strangers can say unkind or unsafe things, or ask players for private details.",
      "It's like a playground that needs grown-ups watching.",
      "Add safety to player chat and names: filter bad words, add block and report buttons, never show real names, and warn players never to share personal information."),
    // ---- phone apps
    K("keys-in-app", "Never put secret keys inside the app", "high", { type: ["mobile"] },
      "Anything inside an app can be pulled out by someone who downloads it.",
      "It's like hiding a key under the mat of a house everyone walks past.",
      "Make sure no secret keys are inside my app. Put them on a server, and let the app ask my server to do the secret work."),
    K("secure-storage", "Keep login tickets in secure storage", "medium", { type: ["mobile"] },
      "Plain files on a phone can be read if the phone is lost or hacked.",
      "It's like locking valuables in the phone's own safe instead of leaving them on the desk.",
      "Store login tokens in the phone's secure storage (Keychain on iPhone, Keystore on Android) and never in plain files or logs."),
    K("permissions", "Ask only for the permissions you really need", "medium", { type: ["mobile"] },
      "Each extra permission is another thing that can go wrong, and people trust you less.",
      "It's like asking a visitor for your house keys when they only need the doorbell.",
      "List every permission my app asks for, remove the ones I don't need, and ask for the rest only at the moment they're needed, with a clear reason."),
    // ---- bots
    K("bot-token", "Guard your bot's token like a password", "high", { type: ["bot"] },
      "With the token, anyone can control your bot and cause trouble in your name.",
      "It's like the remote control for your bot. Don't hand it out.",
      "Move my bot's token into a hidden setting, never print it in logs, and show me how to make a new token in case the old one was ever visible."),
    K("bot-permissions", "Limit who can run powerful commands", "high", { type: ["bot"] },
      "If everyone can run admin commands, one prankster can wreck your server.",
      "It's like letting any visitor press the school fire alarm.",
      "Make powerful commands (delete, ban, settings) work only for specific allowed people or roles, and give the bot the smallest permissions it needs."),
    K("bot-cooldown", "Slow down spammers with cooldowns", "medium", { type: ["bot"] },
      "Without limits, one person can make your bot spam, or run up your bills.",
      "It's like a vending machine that gives one snack at a time.",
      "Add cooldowns and rate limits to my bot's commands, per person and overall."),
    K("bot-privacy", "Don't save private messages you don't need", "medium", { type: ["bot"] },
      "Saved chats you don't need are a juicy target and may break the platform's rules.",
      "It's like keeping other people's notebooks in your bag.",
      "Check what my bot logs or saves. Keep only what it needs, never save private messages, and add a way to delete a person's data."),
    // ---- shops
    K("price-server", "Decide prices on the server", "high", { type: ["store"] },
      "If the price lives only in the browser, a visitor can change it to zero.",
      "It's like a price tag that customers can write on themselves.",
      "Make sure prices, discounts and totals are worked out on my server from my own product list, never trusted from the browser."),
    K("stock-twice", "Stop double orders and overselling", "medium", { type: ["store"] },
      "Two people clicking at once can buy the last item, and one click can charge twice.",
      "It's like two kids grabbing the last cookie at the same moment.",
      "Prevent double charges and overselling, for example with idempotency keys and by checking stock inside one safe step."),
    K("selling-rules", "Check the rules for selling where you live", "medium", { type: ["store"] },
      "Selling things can come with rules about taxes, refunds and age.",
      "It's like needing a permit for a lemonade stand in some towns.",
      "Explain, in simple words, what rules might apply to my kind of shop (taxes, refunds, privacy, age limits) and what I should ask a grown-up or an expert to check. I know this isn't legal advice."),
    // ---- backends / APIs
    K("authz-every", "Check who is allowed on every request", "high", { type: ["backend"] },
      "If you only hide buttons, strangers can still knock on the hidden door, for example by changing an ID in the address to see someone else's data.",
      "It's like checking tickets at the theatre door, not only at the street.",
      "On every private API route, check that the user is logged in AND allowed to see that exact thing (not just any item by ID). Add tests with two different users."),
    K("api-limits", "Limit how often people can call your API", "medium", { type: ["backend"] },
      "Without limits, one person can slow down or crash your server, or run up your bills.",
      "It's like a vending machine that gives one snack at a time.",
      "Add rate limits per user and per IP address to my API, plus maximum request sizes and timeouts."),
    K("cors-strict", "Allow only your own websites (CORS)", "medium", { type: ["backend"] },
      "Allowing every website means any page can call your API in your users' names.",
      "It's like a front desk that only lets in known friends.",
      "Set CORS to allow only my exact website addresses, never *, and never allow credentials together with a wildcard."),
    K("log-safe", "Keep logs useful and private", "medium", { type: ["backend"] },
      "Logs help you spot attacks, but secrets inside logs leak.",
      "It's like a diary for the app: write what happened, never the passwords.",
      "Log important events (logins, failures, errors) with the time and a user id, never passwords, tokens or card numbers, and keep the logs private."),
    // ---- features: login
    K("password-hash", "Don't store passwords as plain text", "high", { feature: ["login"] },
      "If your database leaks, plain passwords expose everyone, even on their other sites.",
      "Scrambling (\"hashing\") a password is like turning a banana into a smoothie that can't be turned back.",
      "Don't write my own password code if I can avoid it: use my database's built-in login (Supabase Auth or Firebase Auth). If I must store passwords, hash them with bcrypt or argon2."),
    K("login-limit", "Limit login tries", "medium", { feature: ["login"] },
      "Without a limit, someone can try millions of passwords.",
      "It's like a safe that lets you guess the code forever.",
      "Add limits to login and password reset: for example 5 wrong tries, then wait, and also slow people down by IP address."),
    K("reset-safe", "Make password-reset links safe", "medium", { feature: ["login", "email"] },
      "A reset link that never expires, or can be guessed, lets strangers take over accounts.",
      "It's like a spare key that works forever.",
      "Make reset links random, single-use and short-lived, and show the same message whether or not the email exists."),
    K("sessions", "Make logins expire and Logout really work", "medium", { feature: ["login"] },
      "Forgotten open sessions are like doors left unlocked.",
      "It's like a hotel key card that stops working after checkout.",
      "Make login sessions expire, make Logout end the session on the server, and use Secure, HttpOnly and SameSite cookies."),
    K("two-step", "Turn on two-step login for important accounts", "low", { feature: ["login"] },
      "Even if a password leaks, the second step stops strangers.",
      "It's like a door with a lock and a code on the doorbell.",
      "Turn on two-step login (an app code) for my admin accounts and for my hosting, database and GitHub accounts, and offer it to my users."),
    // ---- features: database
    K("sql-injection", "Ask the database questions safely", "high", { feature: ["database"] },
      "Glued-together database questions let strangers change the question and read everything.",
      "It's like a form where someone writes \"and also give me everyone's files\" and the clerk obeys.",
      "Use parameterized queries or my database library's safe functions everywhere. Never join user text into a query string."),
    K("row-rules", "Make each person see only their own data", "high", { feature: ["database"] },
      "Many databases let any logged-in person read everything unless you switch rules on. This is the most common beginner leak.",
      "It's like a filing cabinet where every drawer is unlocked.",
      "Turn on row-level rules (Supabase RLS or Firebase Security Rules) so each person can only read and change their own rows, and test it with two accounts."),
    K("db-private", "Never leave the database open to the whole internet", "high", { feature: ["database"] },
      "A database with no password, or a default one, gets found and emptied by bots.",
      "It's like leaving the vault door open.",
      "Make sure my database needs a strong password or key, isn't open to every address, and keeps its connection string secret. Tell me how to check."),
    // ---- features: payments
    K("card-details", "Never touch card numbers yourself", "high", { feature: ["payments"] },
      "Handling card numbers brings huge rules and risk. Payment companies do it safely.",
      "It's like letting the bank's cashier handle the money.",
      "Use my payment company's hosted checkout or secure card fields so card numbers never touch my server. Show me how."),
    K("pay-confirm", "Confirm payments on the server", "high", { feature: ["payments"] },
      "A browser can lie. Anyone can pretend they paid.",
      "It's like believing a sticker that says PAID.",
      "Unlock paid things only after my server has checked with the payment company that the payment really succeeded."),
    K("pay-webhook", "Check that payment messages are real", "high", { feature: ["payments"] },
      "Fake \"payment done\" messages are an old trick.",
      "It's like accepting a note from the bank without checking the stamp.",
      "Verify the signature of every payment webhook with the payment company's own library before trusting it, and make it safe to receive the same message twice."),
    K("pay-test", "Use test mode until you are ready", "medium", { feature: ["payments"] },
      "Mistakes with real money are painful.",
      "It's like practising with play money.",
      "Keep everything in the payment company's TEST mode with test card numbers, and give me a checklist to follow before I switch to live."),
    K("pay-adult", "Ask a grown-up to set up the payment account", "medium", { feature: ["payments"] },
      "Payment companies need an adult for the account, and tax and refund rules differ by country.",
      "It's like needing a grown-up to open a real shop.",
      "Tell me, in simple words, what an adult has to set up for payments (account, bank, taxes, refunds), and what to ask them to check in my country."),
    // ---- features: others
    K("upload-safe", "Make file uploads safe", "high", { feature: ["uploads"] },
      "Uploaded files can be huge, disguised or dangerous.",
      "It's like a mailbox that accepts any package of any size.",
      "Limit upload size and allowed file types (checking the real type), rename files, store them away from my code, never run uploaded files, and serve them from a separate place."),
    K("key-rotation", "Know how to replace a leaked key", "medium", { feature: ["keys"] },
      "Keys leak by accident. Replacing them fast keeps the damage small.",
      "It's like knowing how to change the locks.",
      "Make a short list of every key my project uses and exactly how to replace each one, so I can do it fast if one ever leaks."),
    K("ai-key", "Treat AI keys like credit cards", "high", { feature: ["ai"] },
      "AI keys can run up big bills fast, and bots hunt for leaked ones.",
      "It's like a credit card number: never show it in public.",
      "Make sure my AI service key lives only on my server (never in the browser or app), and that the browser calls my server, which then calls the AI."),
    K("ai-spend", "Set a spending limit and per-person limits", "high", { feature: ["ai"] },
      "A bug or a prankster could send thousands of requests and use up your money.",
      "It's like a prepaid phone card: when it's empty, calls stop.",
      "Set a monthly spending cap or alert in my AI account, and add per-person limits and a maximum message size on my server."),
    K("ai-injection", "People can trick AI helpers (prompt injection)", "high", { feature: ["ai"] },
      "Text from users (or from web pages) can hide orders that make the AI ignore your rules.",
      "It's like a note saying \"forget your teacher and obey me\" slipped into the AI's homework.",
      "Treat everything users or websites send to my AI as untrusted. Never let the AI do risky things (delete, pay, send, read private data) unless my own code checks permission first. Show me how."),
    K("ai-private", "Don't send private data to an AI service", "medium", { feature: ["ai"] },
      "Whatever you send leaves your app, and may be stored by the service.",
      "It's like reading your diary out loud on a phone call.",
      "Check what data my app sends to the AI. Remove names, emails, passwords and other private details unless they're truly needed, and tell users what is sent."),
    K("xss-safe", "Show visitors' text safely", "high", { feature: ["user-content"] },
      "Visitors can type sneaky code into comments, and it runs on other people's screens.",
      "It's like letting visitors write notes that your robot reads out as orders.",
      "Make sure everything users type is shown as plain text (escaped), never as HTML, and add a sanitizer if I must allow formatting."),
    K("moderation", "Plan for spam and unkind posts", "medium", { feature: ["user-content"] },
      "Public places attract spam and unkind content.",
      "It's like a school noticeboard that needs a teacher to check it.",
      "Add spam protection (rate limits, and a CAPTCHA if needed), a way to report and remove bad content, and a block option."),
    K("ws-auth", "Check who is connecting in real-time features", "medium", { feature: ["multiplayer"] },
      "Open connections can be used by anyone who finds the address.",
      "It's like a door with no bouncer.",
      "Make real-time (WebSocket) connections require login, check permissions on every message, and limit how many messages each person can send."),
    K("email-abuse", "Stop others using your app to send spam", "medium", { feature: ["email"] },
      "If anyone can make your app send emails, spammers will, and your email service may ban you.",
      "It's like letting strangers use your stamp machine.",
      "Limit how many emails each person or address can trigger, verify email addresses before sending many, and never let users control the whole message."),
    K("kids-privacy", "Take extra care if kids will use it", "high", { feature: ["kids"] },
      "Many places have strict rules for apps used by children (for example COPPA in the US), and kids need extra protection.",
      "It's like a playground with a fence and a grown-up watching.",
      "Help me make this safe for kids: collect as little information as possible, no real names, no precise location, and no open chat with strangers. List what an adult or an expert should check for the rules in my country."),
    K("admin-lock", "Lock the admin area properly", "high", { feature: ["admin"] },
      "A hidden web address is not a lock. Attackers guess common ones like /admin.",
      "It's like a secret door with no lock.",
      "Protect my admin pages with strong login, an admin role checked on the server, two-step login, and rate limits. Don't rely on a hidden address."),
    K("collect-less", "Collect and keep as little personal data as possible", "high", { feature: ["personal-data"] },
      "Data you don't have can't leak.",
      "It's like not keeping other people's diaries.",
      "List every piece of personal data my app collects, remove what I don't need, protect the rest with access rules and encryption, and add a way to delete a person's data."),
  ];
  // Determine game connectivity from the person's own plan, not AI suggestions.
  // "Unknown" does not imply hosting, accounts, or a backend.
  function detectGameMode(userTexts) {
    const messages = (userTexts || []).map(x => String(x)).filter(Boolean);
    const explicitOffline = /\b(offline|single[ -]?player|solo|local[ -]?only|no multiplayer|no online|without (?:a )?server)\b/i;
    const explicitOnline = /\b(online multiplayer|multiplayer|co[ -]?op|pvp|networked|online game|online leaderboard|cloud saves?|dedicated server|hosted backend)\b/i;
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messages[i];
      const offline = explicitOffline.test(text);
      const online = explicitOnline.test(text) && !/\b(no|without|not|avoid)\s+(?:online\s+)?multiplayer\b/i.test(text);
      if (online && !offline) return "online";
      if (offline && !online) return "offline";
      if (online && offline) return "unknown";
    }
    return "unknown";
  }
  const IMPLIED = { store: ["payments", "database", "login", "personal-data"], backend: ["database"] };

  // A solo/offline game is not automatically a hosted website.
  // Universal web/backend advice only applies when those capabilities exist.
  const GAME_FOUNDATION = new Set(["updates","test-fake","ai-review"]);
  const GAME_ONLINE = new Set(["https","secrets-hidden","env-ignored","validate-input","hide-errors","least-access","backups-test"]);
  const GAME_SERVER_FEATURES = new Set(["multiplayer","login","database","payments","backend","cloud","online"]);
  function gameCheckApplies(check, feats) {
    if (GAME_FOUNDATION.has(check.id)) return true;
    if (check.id === "server-truth") return feats.has("multiplayer");
    if (GAME_ONLINE.has(check.id)) {
      if (![...GAME_SERVER_FEATURES].some(feature => feats.has(feature))) return false;
      if (check.id === "https") return feats.has("multiplayer") || feats.has("backend") || feats.has("online") || feats.has("login");
      if (check.id === "secrets-hidden" || check.id === "env-ignored" || check.id === "least-access") return feats.has("keys") || feats.has("ai") || feats.has("database") || feats.has("backend") || feats.has("payments");
      if (check.id === "backups-test") return feats.has("database") || feats.has("cloud");
      if (check.id === "validate-input" || check.id === "hide-errors") return feats.has("multiplayer") || feats.has("backend") || feats.has("login");
    }
    return true;
  }
  // Returns every safety step that applies to what they are making, most serious first.
  function buildChecklist(type, featureIds, done) {
    const feats = new Set(featureIds || []);
    (IMPLIED[type] || []).forEach((f) => feats.add(f));
    done = done || new Set();
    const label = (PROJECT_TYPES.find((p) => p.type === type) || {}).label;
    const out = [];
    CHECKS.forEach((c, order) => {
      let reason = null;
      if (c.when.all) reason = "Every project that goes online needs this";
      if (!reason && c.when.type && c.when.type.includes(type)) reason = `Because you're making ${label}`;
      if (!reason && c.when.feature) {
        const hit = c.when.feature.find((f) => feats.has(f));
        if (hit) reason = `Because your plan has ${FEATURE_LABEL[hit]}`;
      }
      if (reason && (type !== "game" || gameCheckApplies(c, feats))) {
        if (type === "game" && c.when.all) reason = "Relevant to the features planned for this game";
        out.push(Object.assign({}, c, { reason, done: done.has(c.id), order }));
      }
    });
    return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.order - b.order);
  }
  const checkPrompt = (item, goal) => buildPrompt({
    goal, change: item.todo,
    constraints: ["Change only what is needed. Don't remove my other features.", "Never ask me to paste secret keys into this chat."],
  });

  // A 0-100 "how far along are the safety steps" guide: steps the user ticked (serious ones count more),
  // minus 10 for every serious problem still open in the code. It is a guide, never a promise.
  function safetyScore(list, openHighFindings) {
    if (!list || !list.length) return 0;
    const w = { high: 3, medium: 2, low: 1 };
    const total = list.reduce((a, c) => a + w[c.severity], 0);
    const got = list.filter((c) => c.done).reduce((a, c) => a + w[c.severity], 0);
    return Math.max(0, Math.round((100 * got) / total) - 10 * (openHighFindings || 0));
  }

  return { RULES, NEEDS, TYPE_NEEDS, PROJECT_TYPES, SEV_ORDER, scanCode, checkedCount, maskSecret, maskLine,
    reconcile, detectProject, detectGameMode, buildPrompt, findingPrompt, needPrompt, planNeeds,
    FEATURES, FEATURE_LABEL, detectFeatures, ROADMAPS, CHECKS, buildChecklist, checkPrompt, safetyScore };
});
