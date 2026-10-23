# 🤖 Bob AI — Our Feature Tracker
**Version:** 1.1 · **Updated:** 23 October 2026

> **Start here!** This is our simple plan for building Bob AI. Everything we want Bob to become is tracked here, without complicated coding details.
>
> Need the engineering instructions for Astra? Open the **[Technical Blueprint](./BOB_TECHNICAL_BLUEPRINT.md)**. Want to see the build order? Open the **[Development Roadmap](./BOB_DEVELOPMENT_ROADMAP.md)**.

## 💡 What's Bob AI?

**Bob is our own AI platform — like a chatbot, but also a helpful AI engineer.**

You can talk to Bob about anything, ask questions, learn, brainstorm, or build real apps. Bob understands when you're just chatting and when you want him to actually create something. And our little animated robot Bob explains what he's doing as he works.

**Our big idea:** Make an AI that **talks, builds, checks its own work, and improves with experience**.

## ✨ The six things we want Bob to do

| Our goal | What that means | Progress |
|---|---|---|
| 💬 **1. AI Chat** | Answer questions like ChatGPT or Claude, remember conversations, understand files, and organize chats and projects. | 📝 Planned |
| 🛠️ **2. Build Apps** | Actually create websites and apps, write and fix code, choose suitable free tools, and show working previews. | 📝 Planned |
| 🧠 **3. Understand Projects** | Know what you're trying to do, remember your decisions, and point out useful things you may have forgotten. | 📝 Planned |
| ✅ **4. Test Its Work** | Run real tests, identify errors, explain what passed and what still needs work, and help prepare releases. | 📝 Planned |
| 🤖 **5. Living Bob** | Move, show expressions, use speech bubbles, and point at parts of the workspace while real work happens. | 📝 Planned |
| 🌱 **6. Keep Learning** | Remember useful solutions, and—with permission—learn general lessons from successful experiences across users. | 📝 Planned |

**Important:** These are our agreed *goals*. The current GitHub repository still documents the older **Bob 3.2 browser extension**. We haven't verified that these six standalone-platform features are implemented there. "Planned" does **not** mean "already working."

## 🗺️ What we'll work on, in order

- **Step 1 — Make Bob Chat work well.** Conversations, our AI model, saved chats, projects, settings, and the dark design.
- **Step 2 — Give Bob a brain for projects.** Let him understand whether you want advice or actual building, and what your project needs.
- **Step 3 — Teach Bob to build real things.** Connect safe development tools so he can create files, run code, fix problems, and show previews.
- **Step 4 — Make Bob trustworthy.** Real tests, clear proof of what works, and responsible release controls.
- **Step 5 — Bring little Bob to life.** Reactions and speech bubbles connected to what the AI is *actually* doing.
- **Step 6 — Help Bob improve over time.** Personal memory first, then carefully reviewed lessons shared only with user permission.

Some work may overlap; our [engineering roadmap](./BOB_DEVELOPMENT_ROADMAP.md) tracks the exact dependencies.

## 🧩 Our feature checklist

Everything from our original 16-feature plan is still included. The IDs help us refer to features without losing track of them.

**💬 AI Chat**
- **BOB-01:** Chat and help with everyday questions.
- **BOB-02:** Connect to Nemotron using a user's own OpenRouter API key.
- **BOB-15:** Great dark interface, readable chats, project organization, and proper settings.

**🛠️ App Builder**
- **BOB-04:** A system that plans and carries out tasks safely.
- **BOB-05:** Automatically pick the right tools.
- **BOB-06:** Use appropriate, vetted free/open-source skills.
- **BOB-10:** Create, debug, test, and preview real apps.

**🧠 Project Smarts**
- **BOB-03:** Know what the user wants without requiring a mode button.
- **BOB-07:** Remember project context, decisions, and preferences.
- **BOB-08:** Notice missing features and relevant security needs.

**✅ Trustworthy Results**
- **BOB-09:** Really check the work, not just say it's done.
- **BOB-16:** Help with safe release and deployment when approved.

**🤖 Living Bob**
- **BOB-11:** Animated robot, expressions, helpful bubbles and pointing.
- **BOB-12:** Make reactions follow real events, not imaginary progress.

**🌱 Learning**
- **BOB-13:** Remember useful past engineering experiences privately.
- **BOB-14:** Learn carefully from verified, permissioned shared lessons.

## 📌 Rules we've decided on

- **One Bob, not separate confusing bots.** Normal chatting and software building belong in the same platform.
- **Free tools first.** No required paid skill/tool subscriptions. Free model access can still have limits, and hosting uses real resources.
- **No fake success.** Bob only says something passed when an actual test confirms it.
- **Privacy comes first.** Personal projects and chats do not silently train or teach other users' sessions.
- **No giant complicated menus.** Bob understands the conversation and asks only when necessary.
- **Our mascot is helpful, not distracting.** Users can mute or minimize him.

## 💭 New ideas to explore later

These are **ideas, not promises to build them yet**:

- Bob suggesting new reusable skills based on successful repairs.
- Optional local AI models that work on capable computers.
- Learning which tools work best from carefully reviewed results.
- Eventually investigating how to fine-tune our **own** trainable AI model.

## ✅ How we'll update this tracker

When we think of something new, we add it here first. As we actually build it, its status changes:

**💭 Idea → 📝 Planned → 🔨 Building → ✅ Working → 🧪 Tested**

"Working" means code exists; **"Tested" means there's real proof**. If a feature breaks after an update, we mark it accordingly.

**That's our plan, bro. The complicated architecture lives in the [Technical Blueprint](./BOB_TECHNICAL_BLUEPRINT.md), so this page stays easy to read.** 🚀
