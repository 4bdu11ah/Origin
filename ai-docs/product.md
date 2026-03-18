# Origin — Product Vision

## What Is Origin

Origin is the post-code software creation environment. A spatial, visual interface where you build products by thinking in systems — not syntax. Code is the compilation target underneath, not the interface you interact with.

## The Problem

Vibe coding promised anyone can build software. But the tools still assume you're an engineer:

- **Cursor** — a VS Code fork. Still an IDE. Still files, tabs, terminals.
- **Claude Code** — a CLI. Great for engineers. Hostile to everyone else.
- **Lovable/Bolt/v0** — web-based, limited, no real project ownership.

Non-technical builders hit a wall: they can prompt AI to write code, but they have zero understanding of what was built. Auth becomes a black box. The codebase becomes a pile of files they can't navigate. They're blind passengers in their own product.

## The Solution

Origin replaces the code-first interface with a spatial one. You see your application as an interactive, zoomable map — systems, flows, connections. You click into any node to go deeper. You click to chat with that context. Code exists underneath but you never need to see it.

## Target User

Non-technical builders, domain experts, product thinkers, designers, founders — anyone who thinks in products, not syntax.

## Core Features (v1)

### Spatial Map (The Core)
- AI-generated interactive map of your entire codebase
- Zoomable: Project > System > Feature > Function
- Every node is a conversation entry point — click to chat with that context
- Updates live as code changes

### Session-Based Workflow
- Work in sessions, not files
- Auto-summary at end of each session
- One-click AI-written commits from session log

### Simplified Git
- Plain English explanation of what changed between versions
- Visual timeline instead of git log
- "What's different between production and local?" answered in plain English
- One-click restore to any point

### Project Memory System
- Auto-generates memory files per feature after each session
- Master index of all project rules and decisions
- Prevents hallucinations as codebase grows
- Loads relevant context automatically based on what you're working on

### Minimal UI
- One thing on screen at a time
- Big obvious controls
- Live output console
- No panel overload

### Intelligence Tab
- Proactive refactor suggestions
- Flags complexity before it becomes a problem
- Compares production vs local in plain English

## v0.1 Scope (MVP — Ship Fast)

Two things only:

1. **Spatial map** — AI-generated visual representation of the codebase
2. **Embedded terminal** — users run Claude Code inside Origin

### How It Works

Origin does not build its own AI layer. It uses **Claude Code** as the AI engine and focuses purely on being the visual layer on top.

**The `/origin` Skill:**

- A Claude Code custom skill that analyzes any repo and generates a spatial map
- On first launch, Origin installs the skill to `~/.claude/skills/origin/SKILL.md` (personal scope — works in every project)
- User types `/origin` in Claude Code → skill analyzes the repo → outputs `.origin/map.json`
- Origin watches `.origin/map.json` and renders the spatial map in React Flow

**Why this approach:**
- Zero AI infrastructure to build for MVP
- No API key management (Claude Code handles it)
- No session management (Claude Code handles it)
- The skill works even without the Electron app — it just generates JSON
- `/origin` becomes a viral hook inside the Claude Code ecosystem

### User Flow

1. Download Origin (Electron app)
2. Open a project folder
3. Origin opens with the spatial map + embedded terminal
4. User runs Claude Code in the terminal, types `/origin` to generate/refresh the map
5. User sees their entire app visually, uses Claude Code to build

### What's NOT in v0.1

- Click-to-chat on nodes
- Session workflow / summaries
- One-click commits
- Git visualization
- Project memory system
- Intelligence tab
- Direct API integrations

All of the above moves to v1+.

## Distribution

Open source on GitHub. Launch via Reddit, Twitter (#buildinpublic), Discord.
