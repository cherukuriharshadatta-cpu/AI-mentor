# Bob Ghost Tutor — Chrome/Edge extension

An installable Manifest V3 extension, based on Bob's existing docked interface. Supports ChatGPT, Claude, Gemini, GitHub, and GitHub Gist. Includes OpenRouter streaming chat, optional page grounding, code/page inspector with spotlight and animated connecting beam, and Bob's existing consent-based Checkup experience.

## Install

1. Extract the ZIP to a folder (do not select the ZIP itself).
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the extracted `bob-ghost-extension` folder containing `manifest.json`.
5. Open a **new** supported page or reload an existing supported tab.
6. Click Bob, then **⚙ Settings**. Paste your **own** OpenRouter key from https://openrouter.ai/keys. Select Auto or a supported model. The key is stored in `chrome.storage.local` in your browser extension profile, not shipped in the ZIP. It is sent to OpenRouter by the background service worker for authorized chat requests. Do not share or commit your key.
7. Type a question and hit Enter. Free model availability is subject to provider limits.

## Ghost Tutor

- Select a passage of text/code on a supported page, then click **✨ Inspect page** in Bob.
- Without a selection, Bob tries to identify a visible code block, heading, or main article.
- Bob draws a pulsing orange spotlight and connecting beam. **✕ Clear spotlight** removes both.
- `Teach from this page's content` turns on automatically when you inspect. Ask a question (for example, “Explain this function”) to send a snippet with the prompt to OpenRouter.
- Only visible page DOM is inspected. It cannot automatically read canvas, screenshots, cross-origin iframes, Monaco editors without accessible DOM, or concealed/inaccessible content.

## Privacy and limits

- Inspect highlights run locally; selecting/inspecting alone does **not** send data to OpenRouter. Chat requests do send your question and, when page grounding is enabled, relevant page text. Disable the page switch before asking if content is sensitive.
- Do not use page grounding on pages with passwords, access tokens, or private data. OpenRouter free-model privacy and retention practices vary.
- Checkup uses local rules and requires separate consent; its local analysis is not automatically sent to OpenRouter.
- Automatic extension injection is limited to the supported sites listed in `manifest.json`. Extensions cannot run on `chrome://` or Chrome Web Store pages.
- This is a DOM-grounded visual inspector, **not** screenshot/computer-vision understanding or AI-generated coordinates. The beam aims at the DOM element chosen from the selection or current viewport.

## Verify

Requires Node.js. Run:

```sh
node --check bob.js
node --check ghost.js
node tests/test_engine.js
node tests/test_bridge.js
node tests/smoke_intro.js
node tests/smoke.js
```

No build process and no npm install required.

## Stitch expression update (2.1.0)

Bob now uses the supplied Stitch animation language: an inquisitive tilt/eye-gaze
when generating a response, a celebratory Eureka lift with orbiting blue/green/
coral/iris rings after an answer, and a gentle idle float. The original
terracotta face remains unchanged. The sidebar now starts at 320px instead of
380px and can still be resized from its left edge. Reduced-motion preferences
are respected and the SVG/animations are self-contained (no CDN or Tailwind).
