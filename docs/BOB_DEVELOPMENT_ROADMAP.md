# Bob AI — Development Roadmap
**Roadmap version:** 1.0 · **Updated:** 2026-10-23 · **Status:** Planned sequencing, not a claim of delivery

Companion document: **[Bob Product Blueprint](./BOB_PRODUCT_BLUEPRINT.md)**. That file controls feature scope, priority, decision history, and acceptance criteria; this one controls **execution sequence, dependencies, milestones, release gates and evidence**.

## 0. Critical current-state checkpoint

Repository `main` currently contains **Bob 3.2.0 browser-extension source** (`package.json`, `manifest.json`, `bob.js`, `project-model.js`, `requirements.js`, `verification.js`, etc.). The README explicitly says the extension does **not** edit the user's repository or run builds/deployments.

**Do not mark standalone platform milestones complete based on extension code or screenshots from an uninspected deployment.** If a separate standalone implementation exists, identify its canonical repository, deployment and source revision first. The status of all standalone milestones below starts at **Not independently verified**.

**Recommended migration strategy:** preserve extension releases, assess reuse of project intelligence and verification logic, and introduce a distinct standalone application/module or monorepo package with explicit integration boundaries. No destructive rewrite of `main` by default.

## Roadmap operating rules

- Phase gates are evidence-based and cumulative; do not begin broad later-stage polishing while basic chat or building is nonfunctional.
- **Acceptance tests** must refer to real implementations and revisions. Mocked tests can validate error behavior but do not establish real provider compatibility or actual deployment success.
- Work in small vertical slices, on reviewable branches/PRs where appropriate; run the relevant test suite before merge.
- For each phase record **owner, issue links, PRs, commit SHA, tests, known blockers, and last verification date** once implementation begins.
- A phase may have partial progress without passing its completion gate.
- Do not infer completion from the content of this planning document.

## Milestone overview

| Milestone | Goal | Blueprint IDs | Gate |
|---|---|---|---|
| **M0 — Inventory & migration** | Establish true baseline and protect existing functionality | all, especially 07/08/09 | Canonical codebase identified; tests/baseline recorded; migration chosen |
| **M1 — Bob AI chat foundation** | Usable, persistent standalone AI chat and dark UI | 01, 02, 15 | User can chat with verified model; chats/projects/settings persist |
| **M2 — Intent and project context** | Know when to chat, plan, modify or build | 03, 07, 08 | Contextual routing and capability rules pass scenario tests |
| **M3 — Real agent execution** | Safely build a working web app | 04, 05, 06, 10 | Real sandbox, source edits, build, tests, preview, error recovery |
| **M4 — Independent verification** | Evidence-backed claims, project readiness | 08, 09, 16 (partial) | Revision-linked tests, stale evidence and actionable readiness |
| **M5 — Living Workspace Companion** | Explain actual events visually | 11, 12, 15 | Real event-driven mascot, speech, pointing, accessibility |
| **M6 — Release and GitHub** | Version control and authorized deployment | 10, 16 | Reviewable Git operations, release gates, confirmed provider outcomes |
| **M7 — Private & opt-in learning** | Learn safely from verified outcomes | 13, 14 | Private memory and consented/shared review pipeline evaluated |
| **M8 — Expansion & research** | New platforms, experimental learning | P2 experiments | Adapter-specific tests and explicit approvals, not blanket claims |

### M0 — Inventory, baseline and preservation

**Work:**
- Locate canonical standalone app (if it exists) and confirm relationship to the extension repository.
- Inspect git history, tests, dependency versions, and deployment configurations.
- Record what works, what fails, and what is currently only a mock, prototype, or discussed requirement.
- Establish initial CI and permission model.
- Decide repository structure: separate `apps/web` and `packages/*` or separate repo if cleaner.
- Preserve extension source, user data, and existing release workflow.

**Exit evidence:** baseline test results, source commit, architecture diagram, migration decision, tracked backlog. **Blocked if canonical standalone source is unknown.**

### M1 — Standalone universal chat + UX foundation (P0)

**Deliver:**
- Authenticated standalone chat and conversation storage.
- User's own OpenRouter API key, masked settings and safe server-side transport.
- One **actually tested** Nemotron default; clear errors for quotas, malformed responses, tool calls and provider failures.
- Streaming response, cancellation, persistent history, chat CRUD (new/rename/archive/delete/search).
- Project CRUD (create/rename/archive/delete), associated conversations, safe deletion confirmation.
- Dedicated Settings route, consistent black celestial theme throughout Bob-owned pages.
- Sidebar, spacious responsive chat, accessible composer, no overlapping toasts.

**Tests:** permission isolation, persistence after refresh, provider mock matrix + an authorized live compatibility smoke test, keyboard/mobile browser tests.

**Exit gate:** ordinary Q&A works without agent runs; one active project can be saved/reloaded; UI is readable at representative screen sizes. No fake “working” model selector entries.

### M2 — Automatic intent, structured projects and requirements (P0)

**Deliver:**
- Intent resolver for Q&A / create project / modify project / debug / explain / review / test / deploy.
- Context resolver: current project, message history, accepted decisions, exclusions, relevant files.
- Structured project facts with provenance and uncertainty.
- Capability dependency rules covering accounts, uploads, payments, private data, offline games, AI tools and web services.
- Concise, non-repetitive proactive guidance. Manual modes only optional preferences.

**Tests:** ask for explanation (must not create project); “build website” (creates plan); “add login” (modifies active project), ambiguous project (clarify), offline game (no invented server), gaming upload site (consider isolation).

**Exit gate:** representative intents and requirement-application tests pass; no independent AI proposal silently becomes confirmed user intent.

### M3 — Durable Agent Harness, free skills/tools, working builder (P0)

**Deliver:**
- Durable task state machine with budgets, timeouts, retries, cancellations and checkpoints.
- Built-in tool adapters: file operations, Git, command execution, test/build, preview.
- Isolated sandbox runtime with strict credential boundaries and resource limits.
- Tool registry with license/cost/trust/capability/platform/permission metadata; eligibility filter before AI shortlist.
- Agent Skills indexing and selective loading; third-party scripts reviewed/isolated.
- Real source changes and sandbox build/test execution, with bounded repair attempts.
- Preview tied to a specific built revision; clearly label previous successful previews after failures.

**Free-only constraint:** no mandatory Monid, paid APIs, trials or expiring promotional tool credits. OpenRouter user-key inference is the stated exception, with honest free-tier quotas. Compute/hosting resources remain an operational concern.

**Tests:** safe tool-selection ranking, tool argument validation, execution isolation, error classification, quota handling, real file/build/preview smoke test.

**Exit gate:** user describes a supported simple web app → actual source files produced → real build executed → preview available when successful. Failure must preserve last successful project revision.

### M4 — Independent verification and Project Completion Engine (P0/P1)

**Deliver:**
- Define acceptance criteria during planning.
- Run real tests; store status and logs linked to a commit/snapshot revision.
- Differentiate planned, implemented, failed, untested, stale and verified-in-scope states.
- Invalidate affected evidence when code changes.
- Requirement/readiness panel with explanations, implementation links and checks.
- Security-by-capability guidance with no irrelevant universal checklist.

**Tests:** fake model "fixed it" statement does not mark verified; failed test remains failed; changed source invalidates evidence; deployment blockers derived from real checks.

**Exit gate:** evidence exists for reported successes and can be inspected; no unsupported "secure" or "production ready" claims.

### M5 — Living Workspace Companion and real-time events (P1)

**Deliver:**
- Typed event bus with run ID, sequence, outcome and evidence reference.
- Event replay, reconnect/deduplication, authorization per subscriber.
- Character Director maps events into expressive states and concise bubble messages.
- Bob mascot transitions from home hero to compact workspace companion.
- Contextual gaze/pointing to visible real UI targets; link to evidence (“Why?” / “Show me”).
- Quiet mode, mute, dismiss, reduced motion, collision-safe bubble positioning.
- Preserve important announcements in activity/chat history.

**Tests:** no announcement for events that did not happen, no success after failed run, no repeated bubbles on reconnect, no bubble blocks composer/editor/preview, responsive behavior.

**Exit gate:** observer can watch a real build and see Bob narrate truthful planning/tool selection/build/test events.

### M6 — Repository workflow and Release Guardian (P1)

**Deliver:**
- GitHub integration with least-privilege scopes and branch/diff/commit workflow.
- Build/run evidence attached to source revision and release candidate.
- Deployment adapters for supported destinations, gated by explicit approval.
- Accurate provider deployment state; preview/build errors not hidden.
- Recovery and rollback documentation appropriate to deployment target.

**Exit gate:** a supported app moves from branch/build/tests to approved deployment; reported URL and checks can be verified. Not all apps or destinations must be supported immediately.

### M7 — Engineering Memory and safe Self-Learning (P1)

**Stage A: Private experiences**
- Store error environment, attempted fixes, actual verified outcomes, and applicability constraints.
- Retrieve as suggestions/hypotheses. Don't blindly reuse past code or assume correctness.

**Stage B: Permissioned collective lessons**
- Explicit contribution opt-in; enforce license/secret/privacy rules.
- Generalize lessons without exposing private code, messages, secrets, or identifiers.
- Separate evaluation pipeline: collect → review → test → compare → promote/reject → monitor/rollback.
- Rank tools/skills using real outcome evidence, guarding against biased or poisoned submissions.

**Stage C: Future experiment only**
- Optional fine-tuning research with appropriately licensed downloadable model weights and compute.
- User traffic to Nemotron on OpenRouter **does not train Bob's or Nemotron's model**.

**Exit gate:** lessons demonstrably improve benchmark performance without violating isolation/consent; shared learning stays off until protections and evaluation work.

### M8 — Expanded capabilities (not assumed ready)

Potential additional adapters for mobile, desktop, browser extensions, games, integrations, team accounts, accessibility testing at scale, and optional local models. Each needs separate runtime/tool support, licensing review, compatibility tests, and explicit release readiness.

## Cross-cutting nonfunctional requirements

- **Security:** no privileged generated-code execution; isolated previews; authorization on each project/tool/event; prompt-injection boundaries; safe secrets; explicit approval for impactful actions.
- **Privacy:** private by default, purpose-bound retention/deletion, no automatic cross-user memory, opt-in generalized improvements only.
- **Reliability:** durable idempotent jobs, bounded retries, checkpoints, version-consistent preview/results, meaningful error types.
- **UX:** predominantly black celestial theme, readable resizable chat/preview, full Settings page, Bob mascot grounded in events, reduced motion and keyboard navigation.
- **Cost:** self-hostable/free open-source essential tools and vetted skills; no hidden paid dependency; disclose OpenRouter free quota limitations.
- **Evidence:** documented test scope, source revision, logs, blockers and support boundaries before marking Verified.

## Suggested first implementation tickets

| Ticket | Scope | Depends on | Definition of done |
|---|---|---|---|
| M0-01 | Audit standalone code location and extension reuse | None | Baseline and migration decision recorded |
| M1-01 | Provider adapter + one validated Nemotron configuration | M0-01 | Live authorized smoke test + error matrix |
| M1-02 | Conversations, project CRUD, settings persistence | M0-01 | CRUD and access-control integration tests |
| M1-03 | Dark responsive chat shell + no-overlap composer | M1-02 | Mobile/desktop browser checks |
| M2-01 | Context-aware auto intent routing | M1-01, M1-02 | Intent scenario tests |
| M2-02 | Capability dependency graph | M2-01 | Applicable-vs-irrelevant requirements tests |
| M3-01 | Safe sandbox with real tools, recovery | M0-01 | Real command/build/preview smoke test |
| M3-02 | Registry + free-only tool/skill filtering | M3-01 | Tool safety/eligibility tests |
| M4-01 | Revision-linked evidence and stale invalidation | M3-01 | Verification consistency tests |
| M5-01 | Typed agent event stream | M3-01 | Replay/deduplication tests |
| M5-02 | Character Director + living mascot | M5-01 | Real-event mapping and usability tests |
| M6-01 | GitHub + release approvals | M4-01 | Authenticated non-destructive workflow test |
| M7-01 | Private reusable engineering memory | M4-01 | Relevance + data boundary tests |
| M7-02 | Opt-in shared lesson review pipeline | M7-01 | Consent, de-identification review and benchmark |

## How to maintain this roadmap

Each milestone/ticket should eventually link a GitHub issue and specify:
- **State:** Planned / In progress / Implemented / Verified-in-scope / Blocked / Deferred.
- **Owner and scope**, dependent tickets, design decision(s).
- **Branch, PR, commit SHA, tested revision**, environment and date.
- **Tests:** command(s), outcome(s), skipped checks and limitations.
- **Next action** and the blocker if one exists.

Update [the blueprint](./BOB_PRODUCT_BLUEPRINT.md) when product scope or priority changes. Update this roadmap when implementation sequence or gates change. Never declare roadmap milestones "done" based on a model's self-report alone.

---

**North star:** A user should be able to talk to Bob naturally, build and test a real application with authorized free/open-source tools, understand overlooked requirements through a truthful living companion, and see exactly what was verified versus what remains to be done.
