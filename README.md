# Bob — Universal AI Project Mentor

Bob sits beside your coding AI and explains what your actual project needs to finish, test, protect, release and maintain. It does not write the application, edit your repository, click the host page, or certify production readiness.

## Install 3.1.2

Extract `bob-extension.zip` into a folder. In Chrome/Edge Extensions, enable Developer mode and choose **Load unpacked**, selecting the extracted folder. Alternatively load this repository's root directory. Disable older duplicate Bob extensions and refresh existing AI conversation tabs after updating.

The source files in this repository are canonical. On successful CI runs, GitHub Actions builds and publishes a reproducible `bob-extension.zip` from the tested files (both in the repository and as a workflow artifact). If CI is failing, do not treat its ZIP as a verified release. Monitoring permission and pause state save immediately so a quick refresh does not silently reset them.

## Use

1. Open a ChatGPT, Claude or Gemini development conversation.
2. Open Bob and enable conversation monitoring once. The monitor bar always offers Pause and Disable. Monitoring continues when the panel is collapsed.
3. Bob posts a local project briefing automatically after a complete message is available. Material additions and exclusions produce concise updates; unrelated DOM changes do not duplicate the plan.
4. Open **Project Details** for requirements, source evidence, exclusions, optional suggestions and uncertainty. Cards contain why, what, implementation guidance, verification steps and a tailored copyable prompt.
5. Mark progress as not started, in progress, reported complete or not applicable. To record verification, provide the evidence reference and exact scope you personally reviewed. This is labelled user-reviewed evidence, not an independently executed Bob test. A project change downgrades old verification to reported complete.
6. Optional model reasoning requires an OpenRouter key and a separate **Preview optional AI review → Send this review** action. Inspect or edit the bounded, redacted JSON before sending. Local guidance remains available without a key or when the model fails.

The navigation rail offers Chat, Project Details, Settings and Collapse. Width/height/corner drag handles and Compact/Comfort/Wide presets persist locally. New messages preserve your scroll position and show a new-guidance indicator if you are reading older content. Animations respect reduced motion.

## Project intelligence

User decisions take precedence over assistant proposals. Facts retain a confidence, source role and message identifier, redacted excerpt, timestamp, classification and development stage. Assistant claims of implementation are reported work, not verified work. Conflicts involving excluded capabilities remain visible. Project category is descriptive; capability evidence drives requirements.

Local capabilities cover interfaces, gameplay, game submissions, saves, accounts, databases, cloud data, payments, uploads, networking, APIs, tool-using AI, personal data, roles, device access, dependencies and live services. These are conservative parsing rules, not universal natural-language understanding. Optional model review supports nuanced and unusual projects with source-matched recommendations, explicit assumptions and strict text-only validation. Model suggestions remain clearly separated from deterministic recommendations.

Offline games do not automatically get servers or login. A gaming community accepting games gets submission and execution-isolation requirements; it is not treated as standalone gameplay. Operations requirements depend on a live remote service. Unknown legal obligations are not presented as applicable laws.

## Privacy and boundaries

- No conversation content is read before monitoring is enabled or while paused/disabled.
- Supported role-labelled messages are read; Bob does not fall back to sending or parsing an entire page.
- Conversation messages remain in memory. Up to 30 project snapshots store redacted derived facts, excerpts and progress in extension-local storage. Delete Bob data removes them and the saved key/preferences.
- Local monitoring never calls OpenRouter. Approved reviews send at most 10,000 characters of edited structured context, plus Bob's fixed instructions. The preview initially includes at most 12 messages with at most 900 characters each and a total excerpt budget of 6,000 characters.
- Redaction covers common credential, bearer/JWT/private-key, email and number patterns, but cannot guarantee removal of every sensitive value. Inspect the preview. Provider policies/prices vary by selected model.
- The API key is saved in extension-local storage, not host-page storage, and used only by the extension transport. It is not included in project snapshots or repository files.
- Untrusted text cannot execute HTML, scripts, selectors or tool calls. Model output must match a strict schema, cite an exact user excerpt, and pass local exclusion checks. Rejected output leaves local guidance intact.
- Requests have size limits, 45-second per-model timeouts, cancellation, at most three configured fallback attempts, and no retry after a partial answer.
- Bob can flag patterns in visible code blocks. A pattern is a possible issue, not proof of an exploit, a fix or full safety.

## Modules

| File | Responsibility |
|---|---|
| `conversation.js` | Consent-gated role adapters, streaming detection, per-node cache |
| `project-model.js` | Structured facts, provenance, exclusions, suggestions and conflicts |
| `readiness-planner.js` | Prioritises next actions by capability, stage and progress |
| `requirements.js` | Applicability rules, dependency links, briefing and prompt generation |
| `verification.js` | Distinct progress states and scoped evidence requirements |
| `project-store.js` | Conversation-specific snapshots, bounded retention and deletion |
| `model-reasoner.js` | Minimal preview payload, review schema and grounded output validation |
| `privacy.js` | Redaction and text-only validation |
| `background.js`, `bridge.js` | Bounded/cancellable OpenRouter transport and extension preferences |
| `bob.js` | Sidebar rendering, automatic briefings, resizing and mascot |
| `engine.js` | Existing local code-pattern checks |
| `shield.js` | Isolates Bob's keyboard events from the host page |

## Development and tests

Use Node 22 or later. There are no runtime npm dependencies.

```
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run test:extension
```

The unit/simulated-extension suite covers project scenarios, suggestions vs. decisions, exclusions, dependency links, prompts, verification, privacy gates, caching, storage isolation, provider transport, streaming, updates, scroll preservation, model failure, settings and navigation. The browser suite runs the actual sidebar modules in a Chromium fixture and a separate test exercises real extension loading. Persistent Chromium profiles need operating-system socket support; restrictive containers may block that test before browser startup. CI treats all listed tests as blocking; there is no continue-on-error step.

Build the installable package with `python3 scripts/package.py`. It includes source, documentation and tests but excludes Git metadata, dependencies, secrets and temporary files.

## Known limits

Site markup can change. The observer currently recognises supported ChatGPT, Claude and Gemini message roles; on GitHub or an unrecognised interface Bob offers pasted-description mentoring and does not claim repository access. Conversation windows are bounded to 80 visible messages per role. Older virtualised messages may not be available; Bob cannot reconstruct unseen files or context. English local parsing can misread complex negation or unfamiliar terminology; use the editable model-review preview for deeper interpretation and inspect its assumptions. Bob does not run the user's project, tests, deployments or legal reviews. Live provider quality and current production website markup require testing with your own account and chosen model.
