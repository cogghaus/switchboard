<p align="center">
  <img src="brand/switchboard-wordmark.svg" alt="Switchboard" width="360">
</p>

# Switchboard

A Claude Code plugin that turns your main session into an orchestrator: you route each task to the right specialist sub-agent, at the right model, and review what comes back. Switchboard bundles the roster of specialists and the skills that drive them.

## What is bundled

### `agents/` - the roster (13 specialist sub-agents)

One standalone Claude Code sub-agent per role:

- **Build & design:** Backend Developer, Frontend Developer, Designer
- **Review & testing:** Code Reviewer, Security Reviewer, QA Engineer, Infra Pentester, Red Team Lead
- **Plan & docs:** Architect, Business Analyst, Technical Writer, Release Manager
- **Challenger:** Loki

Each carries a routing description, a tool allowlist, an assigned model, and its full persona - identity, principles, domain expertise, and output formats. A sub-agent is spawned by your main session and returns its result directly.

### `skills/` - how to drive the roster

- **`orchestrator-loop`** - the default operating loop: receive a goal, decide direct vs delegate, route to the right specialist at the right model, review, and report. This makes delegation the default behavior rather than something you improvise. Auto-invokes on substantial tasks (best-effort); the skill documents an opt-in `SessionStart` hook to make it your standing default on every session.
- **`model-routing`** - the model-selection matrix: which model gives the best token-to-quality result for a given task or agent, with the security tier pinned to a stable model. `model-matrix.md` (readable) and `model-matrix.json` (source) ship alongside it.
- **`theme`** - reskin the roster to any naming theme: keep the plain corporate default, or name a subject (a show, game, universe, or motif) and each role is renamed to a fitting character, its function unchanged.
- **`wireup`** - connect the roster to a specific project: set up hooks, MCP servers, and code intelligence (LSP) as a reviewed overlay on the project's own config. Optional, once per codebase.

## Install (local, no marketplace)

```
claude --plugin-dir <path-to-switchboard>
```

Then run `/help` to see the roster and skills. No marketplace or shared config is required to test locally.

## Model assignments

Each agent's `model:` is set from the routing matrix: security agents on a stable safety-carrying tier, design and lateral work on the frontier tier, mechanical and build work on a mid tier, lookups on a small tier. See `skills/model-routing/model-matrix.md`.

## Brand

The wordmark and mark live in `brand/`:

- `brand/switchboard-wordmark.svg` - the primary wordmark; use this wherever it fits.
- `brand/switchboard-icon.svg` - the square amber S mark, for favicons and small icon slots.

Palette: dark `#111B21`, amber `#EBA82F`.

## Project

- [CHANGELOG.md](CHANGELOG.md) - version history.
- [ROADMAP.md](ROADMAP.md) - open and future work.
