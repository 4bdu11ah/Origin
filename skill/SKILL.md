# /origin — Generate a Spatial Map of This Codebase

You are the `/origin` skill. Your job is to analyze the current codebase and generate a structured JSON map that Origin renders as an interactive, zoomable visual representation. The map organizes code by **semantic domain**, not file structure.

## How to Run

### First Run (no `.origin/map.json` exists)

Execute a two-phase generation:

**Phase 1 — Skeleton:** Identify systems and features by reading:
1. The file tree (ignore `node_modules`, `.git`, `dist`, `build`, `release`, `.next`, `__pycache__`, `.origin`)
2. Import/require statements across files (scan file headers, not full contents)
3. Config files (`package.json`, `tsconfig.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.)
4. Use file names, folder structure, and import graph to identify logical systems and features
5. Output: system-level and feature-level map with descriptions

**Phase 1.5 — Self-Review:** Before proceeding to node-level detail, verify:
1. System count is within the target range for this codebase size (see System Count Calibration)
2. No system has fewer than an estimated 3 nodes (a system can have 1 feature if that feature is substantial)
3. No two systems overlap in purpose — describe each in one phrase; if two sound similar, merge them
4. No system is a grab-bag of unrelated concerns (see the grab-bag test below)
5. Largest-to-smallest system ratio by estimated node count — if over 4:1, reconsider (see Balance Rule)

If checks 1–4 fail, restructure before proceeding to Phase 2. Check 5 is a signal, not a hard veto (see Conflict Priority).

**Phase 2 — Detail:** For each system:
1. Read the actual file contents within that system. If a system spans more than ~500 total lines, prioritize exports, public APIs, and entry points. For files over 300 lines, scan signatures and top-level structure rather than full implementations.
2. Generate node-level detail (individual functions, components, routes, classes, etc.)
3. Identify edges/connections between nodes
4. Each node MUST have a 1-sentence description stating what it does
5. Merge into the map

### Subsequent Runs (`.origin/map.json` exists)

Do an incremental update:
1. Read the existing `.origin/map.json`
2. Read `.origin/meta.json` for the last-run commit hash
3. Run `git diff <lastRunCommit>..HEAD --name-status` to find changed files
4. Only re-analyze the changed/new files
5. Merge updates:
   - **Modified files** → re-generate their nodes and edges
   - **New files** → add to appropriate system/feature (or create new ones)
   - **Deleted files** → remove their nodes and edges
6. Run the Phase 1.5 self-review checks against the updated map. If checks 1–4 fail, restructure before writing output. Check 5 (balance) is a signal — reconsider but don't force.
7. Rewrite `.origin/map.json` and `.origin/meta.json`

## The Universal Abstraction: 4 Levels

Every project maps to this hierarchy:

```
Project → Systems → Features → Nodes
```

| Level | What it represents | How to identify |
|-------|-------------------|-----------------|
| **Project** | The whole app | Root directory, package name |
| **System** | A logical domain | Group by semantic meaning, not folders. E.g., "Auth", "Payments", "API", "Database" |
| **Feature** | A capability within a system | A user-facing or developer-facing capability. E.g., "Login", "Signup", "Password Reset" |
| **Node** | A code unit | Function, component, class, route, hook, config, type, test |

**Key principle:** Group by **meaning**, not file path. A React component in `/components/LoginForm.tsx` and a route in `/api/auth/login.ts` both belong to the "Auth" system.

**Ambiguous grouping:** When a module serves two systems, place it in the system that would break if the module were removed.

### Cross-cutting concerns

Do not create standalone systems for cross-cutting concerns. Instead:
- **Types/interfaces** → place in the system whose behavior they define, not a separate "Types" system
- **Shared utilities** → place in the system that uses them most, or omit if trivial
- **Config files** → merge into the build/infrastructure system, or omit
- **Boundary code** (preload scripts, middleware) → place in the system whose boundary they enforce

**Grab-bag test:** If a system's features don't share a common user, data, or lifecycle concern — if you could remove one feature without affecting the others — the system is a grab bag. Redistribute.

## Project Type Detection

Detect the project type from config files and structure, then map accordingly:

| Project Type | Typical Systems |
|-------------|----------------|
| **Frontend** (React/Vue/Svelte) | Pages/Views, Components, State, Data Fetching |
| **Backend** (Express/Django/FastAPI) | Routes, Business Logic, Data Layer, Services |
| **Full-Stack** (Next.js/Remix) | Pages, API, Data, Auth |
| **CLI Tool** | Commands, Config, Core Logic |
| **Library/SDK** | Public API, Core Modules |
| **Monorepo** | Group related packages into logical systems (see below) |
| **ML/Data** | Ingestion, Preprocessing, Training, Evaluation, Serving |
| **Mobile** (React Native/Flutter) | Screens, Navigation, Services, Storage |
| **Desktop App** (Electron/Tauri) | Main Process, Renderer/UI, IPC, Native Services |
| **Browser Extension** | Background, Content Scripts, Popup UI, Storage |
| **Game** | Engine, Rendering, Input, Game Logic, Assets |
| **Infrastructure** (Terraform/Pulumi) | Networking, Compute, IAM, Monitoring |
| **Compiler / Language Tool** | Parser, AST, Analyzer, Code Gen |

**Monorepos:** For monorepos with >12 packages, group related packages into logical systems. Shared/common packages are cross-cutting concerns. If the user opened a specific app within the monorepo, scope the map to that app.

**Multi-language projects:** Treat each language boundary as a natural system boundary.

**Fallback:** If the project doesn't match any type, derive systems from directory structure, entry points, and deployment boundaries.

## System Count Calibration

Count source files after tree scanning (exclude tests, config, and generated files). Use this table as a guide — not a hard cap — but strongly prefer staying in range. If you find yourself at 8 systems for a 15-file project, you've over-split.

| Source files (excl. tests, config, generated) | Target systems |
|---|---|
| 1–15 | 2–4 |
| 16–50 | 3–6 |
| 51–200 | 5–8 |
| 200+ | 6–12 |

### System Balance Rule

After drafting systems, check the ratio between the largest and smallest system by estimated node count. If the ratio exceeds 4:1, reconsider — either split the large system or merge the small one into its closest neighbor. But don't force it if both systems represent genuinely distinct concerns. Prefer coherent boundaries over arithmetic balance. A system with only 1–2 nodes should almost never stand alone — merge it.

### Conflict Priority

When constraints conflict: (1) System count calibration is the primary constraint. (2) The project type table is suggestive — merge or drop suggested systems to fit the count range. (3) Balance and feature-minimum checks are secondary quality signals, not hard vetoes.

## Output Schema

Write the output to `.origin/map.json`:

```json
{
  "version": "0.1",
  "project": {
    "name": "<project name from package.json, Cargo.toml, etc.>",
    "description": "<1-2 sentence AI-generated summary of what this project does>"
  },
  "systems": [
    {
      "id": "<kebab-case-id>",
      "label": "<Human Readable Name>",
      "description": "<1-2 short sentences>",
      "color": "<hex color>",
      "features": [
        {
          "id": "<system-id/feature-kebab-id>",
          "label": "<Feature Name>",
          "description": "<1 short sentence>",
          "nodes": [
            {
              "id": "<system-id/feature-id/node-kebab-id>",
              "label": "<NodeName>",
              "type": "<component|function|route|model|middleware|class|hook|config|type|test>",
              "file": "<relative file path>",
              "line": 0,
              "description": "<1 short sentence. State what it does, not how.>"
            }
          ]
        }
      ]
    }
  ],
  "edges": [
    {
      "from": "<node-id>",
      "to": "<node-id>",
      "type": "<calls|imports|renders|data-flow|navigates|extends|emits|configures>",
      "label": "<optional: short description like 'on submit' or 'fetches user'>"
    }
  ]
}
```

### System Color Palette

Reference palette (10 colors):

| Color | Hex |
|-------|-----|
| Pink | `#EC4899` |
| Purple | `#A855F7` |
| Green | `#22C55E` |
| Orange | `#F59E0B` |
| Blue | `#4A90D9` |
| Teal | `#14B8A6` |
| Red | `#EF4444` |
| Indigo | `#6366F1` |
| Cyan | `#06B6D4` |
| Gray | `#6B7280` |

**Assignment rules:**
1. Assign colors by system size — largest systems get the most visually distinct colors (pink, purple, green, orange) first
2. **Hard rule: no two systems may share a color.**
3. If there are more systems than 10 colors, derive additional colors by adjusting lightness of existing palette entries (e.g., `#A855F7` → `#C084FC`)

### Node Types

Use these types for nodes:
- `component` — UI component (React component, Vue SFC, Svelte component)
- `function` — Standalone function or utility
- `route` — API endpoint or page route
- `model` — Data model, schema, or ORM entity
- `middleware` — Request middleware, interceptor, or guard
- `class` — Class definition
- `hook` — React hook, Vue composable, or similar
- `config` — Configuration file or setup
- `type` — TypeScript type/interface, Python dataclass, etc.
- `test` — Test file or test suite

### Edge Types

Use these types for edges:
- `calls` — Function A calls function B
- `imports` — Module A imports from module B (use sparingly — only for key dependencies)
- `renders` — Component A renders component B
- `data-flow` — Data flows from A to B (API response, state update, etc.)
- `navigates` — Navigation from screen/page A to B
- `extends` — Class/type inheritance or implementation
- `emits` — Event emission or subscription (pub/sub, EventEmitter, signals)
- `configures` — Dependency injection, setup, or middleware chain registration

## Also Write `.origin/meta.json`

After generating the map, write `.origin/meta.json`:

```json
{
  "lastRunCommit": "<current git HEAD commit hash>",
  "lastRunTimestamp": "<ISO 8601 timestamp>",
  "generatedSystems": ["<list of system IDs that have full node detail>"],
  "pendingSystems": []
}
```

Get the commit hash via `git rev-parse HEAD`.

## Quality Guidelines

1. **Descriptions are for orientation, not documentation.** All descriptions are 1 sentence. Systems may use 2 short sentences. A reader should understand each node's role in under 3 seconds.

   Good: `"Creates the main BrowserWindow with secure defaults and dark theme."`
   Bad: `"Creates the main BrowserWindow with macOS-style hidden titlebar, dark background, and secure webPreferences (contextIsolation enabled, nodeIntegration disabled). Loads the renderer from either the Vite dev server URL or the built HTML file."`

2. **Group by semantics.** An auth-related component and an auth API route belong in the same "Auth" system, even if they're in completely different folders.

3. **Be selective with nodes.**

   **Include as nodes:**
   - Exported functions/classes/components that define a module's public behavior
   - Route handlers, data models, hooks, key config

   **Exclude:**
   - Internal helpers used in only one place
   - Re-export barrels (`index.ts`)
   - Type-only files with fewer than 3 types
   - CSS/style files, generated code, test utilities

   **Feature sizing:** Aim for 2–6 nodes per feature. 1-node features should be merged. 8+ node features should be split.

4. **Be selective with edges.**

   **Create edges for:** cross-system data flow, render trees, key call chains, navigation flows, event emissions.

   **Never create edges for:** type-only imports, utility function calls, standard library usage, re-exports.

   **Budget:** Aim for roughly 1–2 edges per node on average. The map should show structure, not every import.
5. **IDs must be hierarchical.** System: `auth`. Feature: `auth/login`. Node: `auth/login/login-form`. This enables the UI to resolve navigation.
6. **File paths are relative** to the project root.

## Execution

1. Create the `.origin/` directory if it doesn't exist: `mkdir -p .origin`
2. Generate the map following the phases above
3. Write `.origin/map.json` (pretty-printed with 2-space indent)
4. Write `.origin/meta.json`
5. Confirm completion to the user with a brief summary: how many systems, features, and nodes were generated
