# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Origin is a post-code software creation environment — a spatial, visual desktop app where non-technical builders create products by thinking in systems, not syntax. Code is the compilation target underneath, not the interface. Think of it as what comes after IDEs and AI code editors.

**Target users:** Non-technical builders, domain experts, product thinkers, designers, founders.

## Tech Stack (v0.1)

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron |
| Frontend | React + TypeScript |
| Spatial Map | React Flow |
| Terminal | xterm.js + node-pty |
| AI | Claude Code (via `/origin` skill — no direct API integration) |
| File Watching | chokidar |

## Architecture (v0.1)

Origin does not build its own AI layer. It uses Claude Code as the AI engine via a custom skill.

**Electron App:**
- **Main Process:** File system access, watch `.origin/map.json`, install skill to `~/.claude/skills/origin/` on first launch
- **Renderer Process (React):**
  - **Spatial Map (React Flow):** Renders `.origin/map.json` as an interactive zoomable node graph (project > system > feature > function)
  - **Embedded Terminal (xterm.js):** For running Claude Code directly inside Origin

**Claude Code Skill (`/origin`):**
- Installed to `~/.claude/skills/origin/SKILL.md` (personal scope — works in any project)
- Analyzes repo structure, generates structured JSON map, writes to `.origin/map.json`
- Works independently of the Electron app

## v0.1 Scope (MVP)

Only two things:
1. Spatial map — AI-generated visual representation of the codebase
2. Embedded terminal — users run Claude Code inside Origin

Everything else (click-to-chat, sessions, commits, git viz, memory, intelligence tab, direct API integrations) is v1+.

## Design Documents

All planning documents live in `ai-docs/`:
- `product.md` — Product vision, features, v0.1 scope
- `tech-stack.md` — Technology choices and architecture
- `branding.md` — Brand positioning, voice, and messaging

## Distribution

Open source. Desktop builds via electron-builder targeting macOS, Windows, and Linux.
