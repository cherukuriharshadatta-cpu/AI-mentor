# Bob AI — Technical Blueprint (for builders and Astra)
**Blueprint version:** 1.0 · **Updated:** 2026-10-23 · **Owner:** Bob AI project · **Status:** Product specification (not an implementation claim)

> **Technical reference:** This is the detailed engineering specification. For the easy-to-read feature tracker, see [Bob's Simple Product Blueprint](./BOB_PRODUCT_BLUEPRINT.md). Use this document with the [development roadmap](./BOB_DEVELOPMENT_ROADMAP.md) when implementing, testing, or reviewing features.

## 1. Product vision

**Bob — The AI That Builds Beyond the Prompt.**

Bob is a **general-purpose AI conversation platform** and **project-aware autonomous software builder**. A user can ask ordinary questions, study, research, discuss ideas, or build an application in the *same conversation*. Bob recognizes the intended task without mandatory manual mode selection.

The **Agent Harness does the engineering**; the **Living Workspace Companion makes genuine engineering activity understandable and engaging**.

Bob's differentiation is not an assertion that competitors cannot code or use tools. It is an integrated, persistent **Project Completion Engine**: understand goals → discover relevant requirements → plan → choose appropriate skills/tools → execute authorized work → test → attach evidence → explain → prepare release.

### Intended experience

1. User describes a project in chat.
2. Bob resolves context, intent, and project identity without inventing requirements.
3. Bob proposes/chooses relevant capabilities, tools, and skills within permissions.
4. Authorized tools create/edit code, run builds and tests in isolated workspaces, and show a real preview.
5. Capability dependencies surface overlooked functionality, security, accessibility, and operational needs **only where applicable**.
6. Independent verification records what actually passed for a specific source revision.
7. The animated Bob companion reacts to *real events*, teaches succinctly, and can point to relevant UI; important messages remain in persistent history.
8. Users can refine, commit, review, and approve deployment.

**Initial implementation focus:** full-stack web applications. Additional application categories require their own real build, test, and deployment adapters.

## 2. Scope and current reality

- **Current GitHub `main` at this review:** `package.json` and `README.md` describe **Bob 3.2.0**, a consent-gated browser extension that observes supported chat pages and provides *guidance*, not direct code execution. Its documented modules include `project-model.js`, `requirements.js`, `verification.js`, and `model-reasoner.js`. These are **reuse candidates**, not proof of standalone Bob AI functionality.
- **Standalone Bob 4.0 platform:** the target described below. Its current implementation may live outside this repository; **repository inspection and tests must establish the actual implementation state** before any tracker item is changed to Implemented or Verified.
- **This blueprint's tracked features are product commitments/intent**, not a claim that the current repository ships them.
- **No production-readiness or security guarantees** follow from writing a specification or generating code.

### Status vocabulary (never conflate these)

| Status | Meaning | Required basis |
|---|---|---|
| Idea | Uncommitted proposal | Description and rationale |
| Approved | Agreed product direction | Explicit decision |
| Planned | Scoped engineering work with acceptance criteria | Owner, dependencies, milestone |
| In progress | Actual development commenced | Branch/PR/run reference |
| Implemented | Function exists in current code | Relevant files/commit |
| Verified | Acceptance criteria passed *in a defined scope* | Tests/results, source revision, timestamp |
| Blocked | Cannot proceed | Concrete blocker, next action |
| Deferred | Intentionally postponed | Decision and reason |

**Rule:** all BOB-01…BOB-16 are currently **Approved product goals / implementation unverified for the standalone platform**. Extension functionality must be reported separately; never inherit "Verified" from an unrelated codebase.

## 3. Master feature register

Priority: **P0** = core foundation; **P1** = next product tier; **P2** = experiment/later. Each row represents a *feature family*. Track implementation stories and test evidence separately.

| ID | Feature family | Priority | Depends on | Acceptance criteria (minimum) |
|---|---|---|---|---|
| **BOB-01** | Universal AI chat: natural conversation, explanations, learning, research assistance, file-aware help | P0 | BOB-02, BOB-15 | User can chat, stream responses, switch/delete/archive conversations, recover history; general questions do not trigger coding jobs. |
| **BOB-02** | User-provided OpenRouter key + **one tested Nemotron configuration**; model-provider abstraction | P0 | Credentials, provider adapter | Server-side key protection; real provider health and compatibility checks; tool/text/empty/error outcomes normalized; truthful quota messaging. |
| **BOB-03** | Automatic intent and context routing; optional manual preferences | P0 | BOB-01, BOB-07 | General Q&A, create app, modify active project, debug and review route correctly; ambiguous project selection asks rather than guesses. |
| **BOB-04** | Durable Agent Harness: planner, permissions, execution states, budget, cancellation, retries | P0 | BOB-02, BOB-03, execution runtime | Authorized tasks have durable state, checkpoints, failure recovery, idempotent side-effect handling and bounded repair attempts. |
| **BOB-05** | Intelligent Tool Router and registry; filtered shortlist | P0 | BOB-04, tool metadata | Filters by capability/platform/license/cost/trust/permissions; selects relevant tools without dumping an entire catalog into context; validates arguments. |
| **BOB-06** | Free/open-source Agent Skills Engine; selective skill loading | P0 | BOB-04, BOB-05 | Reads skill metadata; loads only relevant reviewed skills; rejects incompatible, untrusted, non-compliant scripts/dependencies. |
| **BOB-07** | Project Intelligence: persistent facts, source provenance, capabilities, context and exclusions | P0 | Project persistence, BOB-01 | Follow-up tasks reuse correct project and decisions; inferred facts are distinguished from confirmed user intent. |
| **BOB-08** | Unknown-Unknowns / Requirements Intelligence: capability dependency graph | P0 | BOB-07 | Project-specific requirements change with project capabilities; login/uploads/payments/AI tools have applicable checks; offline-only apps avoid invented server requirements. |
| **BOB-09** | Independent Verification: actual tests, evidence and revision linkage | P0 | BOB-04, BOB-10 | Claims have scoped evidence; failing/skipped tests remain visible; affected evidence becomes stale when source changes. |
| **BOB-10** | Autonomous App Builder: source files, sandbox, build/test/repair, live preview, Git workflows | P0 | BOB-02, BOB-04, BOB-05, BOB-09 | Prompt produces real runnable files for a supported app; builds/tests run; preview maps to actual revision; rollback/cancel/recovery work. |
| **BOB-11** | Living Workspace Companion: expressive Bob, small bubbles, contextual pointing, teacher-like behavior | P1 | BOB-12, BOB-15 | The mascot reacts to genuine events, never invents successes, never obstructs work, can be muted/dismissed, and respects reduced motion. |
| **BOB-12** | Real-time structured Agent Events + Character Director | P1 | BOB-04, BOB-09 | Typed events have run IDs, sequence/deduplication, outcomes, evidence refs; animation/message choice driven by events and survives reconnect. |
| **BOB-13** | Private Engineering Memory: problems, attempts, verified fixes, applicability context | P1 | BOB-07, BOB-09 | Retrieves relevant past experiences as hypotheses; never treats past fixes as universally valid; project/user boundaries enforced. |
| **BOB-14** | Opt-in Self-Learning: reviewed generalized lessons, tool ranking, evaluation; eventual model-training research | P1 | BOB-09, BOB-13, consent & evaluation | No raw private chats/code silently shared; contributions opt-in, checked for sensitive data, evaluated before promotion, reversible where feasible. |
| **BOB-15** | Premium UX: black celestial design, readable responsive chat/preview, full settings, chats/projects CRUD | P0 | UI shell, persistence | Dedicated settings route; real create/rename/archive/delete with safety; resizable panels, readable chat, correct toasts; all Bob-owned pages themed consistently. |
| **BOB-16** | Release Guardian: readiness, deployment approvals, GitHub and maintenance workflow | P1 | BOB-09, BOB-10 | Evidence-backed release blockers; verified deployment results only; external actions require authorization; secrets not exposed. |

### Functional details that must not disappear into the feature-family table

**Conversation and projects (BOB-01 / BOB-15):** New chat, rename, archive, delete, search, stable IDs, conversation-to-project association, project creation/import, rename/archive/delete/export, safe confirmation, persistent settings. Deleting Bob records must **never silently delete external repositories or deployments**.

**Automatic mentoring (BOB-03 / BOB-07 / BOB-08):** No compulsory Build/Review/Plan mode picker. Bob should infer intent from submitted messages and current project; explain why additional requirements apply; avoid repetitive unsolicited warnings. Unsent keystrokes are not sent for analysis.

**Free-first decision (BOB-02 / BOB-05 / BOB-06):** Use user-supplied OpenRouter API keys for Nemotron *for now*, subject to free endpoint caps and availability. No mandatory Ollama, Monid, paid tool API, trial-credit or pay-as-you-go integrations. Open-source tools/software may still require local hardware, storage, electricity or self-hosting resources. Inspect licenses, runtime dependencies and terms before bundling. Do not promise unlimited free model inference.

**Execution and verification (BOB-04 / BOB-09 / BOB-10):** Code runs inside isolated, least-privilege sandboxes; verify source revision, build artifact and preview consistency. On an API quota failure, don't waste source-repair attempts. Keep the previous working preview explicitly marked as such if the latest build fails.

**Living Bob (BOB-11 / BOB-12):** Cream-and-terracotta original robot, animated in home hero and transitioning into a small project companion. Expressions: idle, listening (local UI event only), thinking, tool selection, building, testing, discovery, warning, error, success, approval. Bubble messages must be grounded in actual events; connect "Show me"/"Why?" actions to relevant artifacts or evidence. Quietness, reduced motion, dismiss/mute and screen-boundary collision handling are required.

**Self-learning (BOB-13 / BOB-14):** Stage 1 = per-project/private memory and verified technical experiences. Stage 2 = opt-in, reviewed, generalized collective lessons and statistical tool/skill ranking. Stage 3 = optional research into fine-tuning a licensable open-weight model; **not automatically training Nemotron via OpenRouter**. Respect deletion requests, provenance, licensing, consent scope and retention limitations.

## 4. Core technical architecture

```text
User message / authorized project action
  → Context & intent resolver (BOB-03, BOB-07)
  → Agent controller (BOB-04; durable state, budget, approvals)
  → Requirements engine (BOB-08; capability graph)
  → Skills matcher + Tool Router (BOB-06, BOB-05)
  → Nemotron reasoning (BOB-02; normalized responses)
  → Safe sandbox / Git / tests / preview (BOB-10)
  → Independent verification (BOB-09)
  → Project memory & evidence store (BOB-07, BOB-13)
  → Structured agent event stream (BOB-12)
  → Bob Character Director / Living Companion (BOB-11)
  → User-facing chat, progress and workspace (BOB-01, BOB-15)
```

**Responsibilities:** AI suggests contextual decisions; application code enforces permissions, policy, tool eligibility, state transitions and evidence validity. Do not trust tool output, repository instructions, external skills, or AI prose as higher-priority authorization.

**Potential implementation stack (evaluate against the actual standalone repository):** Next.js/React/TypeScript, Tailwind, server-side OpenRouter integration, PostgreSQL with migrations, durable background jobs, sandboxed workers, Git, Playwright, and self-hostable free tooling. **This is a proposal, not a declaration that these dependencies already exist here.**

## 5. UX/design contract

**All Bob-owned screens:** near-black/obsidian surfaces (`#07080A`, `#090A0D`, `#0D0F14`, `#0F1117`), subtle Gemini-inspired blue/violet ambient lighting (`#4285F4`, `#9B72CF`), Bob terracotta `#BA5D39`, cream mascot `#F3DFD5`; readable typography, subtle borders, real focus/error states.

**Routes/views:** Home, Chat, Projects, Library, Archived, Studio, Settings, Readiness, Deployments, and honest loading/error states. Settings is a **dedicated page**, not an oversized blocking pop-up. Generated app previews retain **their own** themes.

**Studio desktop default:** compact global sidebar (~240–260px) and resizable chat/preview area (~45/55 split, adjusted to viewport). Support preview maximize, correct nested scroll behavior, fixed/expanding accessible composer, no notification overlap, mobile tab fallback.

**Companion presence:** home-screen centered mascot → compact in-workspace companion on project entry. Speech bubbles, gaze/pointing, and highlights must be driven by genuine events and not interfere with chat, code or preview. Key information also persists in chat/activity.

## 6. Permissions, privacy and safety invariants

- Project/user/organization access boundaries are enforced server-side.
- Files and generated code execute only in safe, isolated environments, never unrestricted production hosts.
- User-provided API keys are protected server-side and never logged or exposed to generated frontend bundles.
- Consequential actions (publishing, production deployments, external deletion, costs, credentials) require appropriate approval.
- Third-party tools and skills are untrusted until reviewed; licensing and runtime permissions must be checked.
- There is **no automatic collective learning from private conversations**; cross-user learning is explicitly opt-in with carefully filtered, reviewed contributions.
- Statements like "fixed," "passed," "deployed," and "secure" must be scoped to real evidence. No absolute security guarantees.
- Reduced motion, accessibility, responsive layouts, and opt-out of mascot commentary are first-class requirements.

## 7. Product decision log

| Decision | Outcome | Notes |
|---|---|---|
| Universal platform vs coding-only chatbot | **Universal chat + integrated AI Studio** | Same chat context can lead to coding workflow. |
| Model strategy | **Nemotron via user-owned OpenRouter keys initially** | Choose one *tested* compatible configuration; provider abstraction supports later changes. |
| Cost posture | **Free/open-source tools and skills as default requirement** | OpenRouter free endpoints still impose external quotas; infrastructure isn't costless. |
| Tool ecosystem | **Trusted local tools, vetted GitHub skills, optional MCP adapters** | No required Monid. A 1,000-tool index is not 1,000 working installed tools. |
| Autonomy UX | **Infer intent automatically** | Explicit approval for consequential operations; optional user preferences. |
| Verification | **Independent evidence, not LLM assertions** | Evidence tied to revision and task. |
| Mascot | **Living Companion driven by real events** | Mentor/teacher personality, contextual pointing, no false status. |
| Cross-user learning | **Private default, explicit opt-in for generalized lessons** | Fine-tuning a separate trainable model is future research. |
| Current repo | **Preserve the 3.2.0 extension until migration is deliberately planned** | Don't claim extension modules already form a runnable standalone builder. |

## 8. Ideas and experiments — NOT approved commitments

Keep experiments separate from the approved backlog; require a product decision before assigning a BOB feature ID:

| Experiment | Hypothesis | Promotion gate |
|---|---|---|
| Automatically propose new reusable skills from successful repairs | Reviewed skill synthesis may reduce repeated debugging effort | Provenance, security review, sandbox testing, user consent, measurable benefit |
| Offline/local model optional adapter | Could reduce OpenRouter dependence for capable devices | Hardware benchmark, realistic setup UX, licenses, no forced downloads |
| Tool ranking from aggregated success rates | May improve task completion | Opt-in evidence quality, statistically meaningful evaluation, bias checks |
| Proactive companion teaching preferences | Could improve comprehension | Low interruption rate, accessibility/usability testing |
| Model fine-tuning | Might improve narrow engineering tasks | Suitable weights/license, permissioned curated data, compute plan, benchmark improvements |

## 9. Tracker update protocol

For every new feature or change:

1. Record an idea, its owner/decision, and rationale; **don't silently change approved scope**.
2. Assign a stable feature ID (or child ticket `BOB-XX.N`), dependencies, priority, and acceptance tests.
3. Link branch/PR/commit when work begins.
4. Mark **Implemented** only when linked code exists.
5. Mark **Verified** only with dated, scoped test/evidence references tied to a source revision.
6. Demote stale verification after relevant code changes.
7. Track blocker, risk, and next action.
8. Update the [roadmap](./BOB_DEVELOPMENT_ROADMAP.md) and this decision log when scope or sequence changes.

**Status accuracy is more important than apparent progress.** A compelling visual UI, an optimistic model message, or a planning document is not proof of implementation.
