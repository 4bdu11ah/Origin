# Origin — Tech Stack

## Stack (v0.1)

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop Shell | **Electron** | Proven for dev tools (Cursor, VS Code). Native feel, full file system access, cross-platform. |
| Frontend | **React + TypeScript** | Industry standard. Massive ecosystem. Easy to hire/attract contributors. |
| Spatial Map | **React Flow** | Purpose-built for interactive node-based UIs. Zoom, pan, click, drag. Exactly what we need. |
| Terminal | **xterm.js** | Embeddable terminal for running Claude Code inside Origin. |
| AI | **Claude Code (via skill)** | No direct API integration. Origin installs a `/origin` skill — Claude Code does the AI work. |

## Architecture (v0.1)

```
Electron App
├── Main Process
│   ├── File system access (read project directories)
│   ├── Watch .origin/map.json for changes
│   └── On first launch: install skill to ~/.claude/skills/origin/SKILL.md
│
└── Renderer Process (React)
    ├── Spatial Map (React Flow)
    │   ├── Renders .origin/map.json as interactive node graph
    │   ├── Zoom levels (project > system > feature > function)
    │   └── Updates when map.json changes
    └── Terminal (xterm.js)
        └── Embedded terminal for running Claude Code
```

```
Claude Code Skill (~/.claude/skills/origin/SKILL.md)
├── Analyzes repo structure
├── Generates structured JSON map
└── Writes to .origin/map.json
```

## AI Model Support

**v0.1:** No direct AI integration — delegates to Claude Code via skill

**v1+:** Direct API integrations, multi-model support

## Map Generation Approach

**v1:** Pure AI — feed files to Claude, ask for structured JSON representing app architecture. Slower but ships fast.

**Future:** Hybrid — static analysis (AST parsing) for structure, AI for human-readable labels and summaries. Faster, cheaper.

## Key Dependencies (v0.1)

- `electron` — desktop shell
- `react` + `react-dom` — UI
- `reactflow` — spatial map
- `xterm` + `node-pty` — embedded terminal
- `chokidar` — file watcher for .origin/map.json
- `typescript` — type safety

## Development

- Package manager: npm or pnpm
- Build: electron-builder for distribution
- OS targets: macOS, Windows, Linux
```
