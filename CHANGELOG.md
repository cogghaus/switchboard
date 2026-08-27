# Changelog

All notable changes to Switchboard are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.4] - 2026-08-27

### Added
- Rendered in-site documentation pages (usage, agents, skills, install) styled to match the site, generated from the markdown by `docs/render.py` and sharing `docs/docs.css`. The landing page's Documentation section now links to these rendered pages instead of GitHub.

## [0.9.3] - 2026-08-26

### Added
- Public landing and setup site (`docs/index.html`, served via GitHub Pages): install walkthrough, roster overview, setup options, and links into the docs.

## [0.9.2] - 2026-08-26

### Added
- `docs/` set: `usage.md` (the orchestrator workflow), `agents.md` (per-agent reference), `skills.md` (per-skill reference), and `install.md` (install, sharing, theming, wiring into a project). The README links them under a Documentation section.

## [0.9.1] - 2026-08-26

### Added
- MIT LICENSE file and a matching `license` field in the plugin manifest, making reuse terms explicit ahead of going public.

## [0.9.0] - 2026-08-26

### Changed
- Top-down refactor / efficiency / quality pass across the whole plugin, driven by a three-part audit.
- Normalized section headings across all 13 agents to one skeleton (Operating Principles, Domain, Working Method, Outputs, Trust Boundary, Completion, When to Stop and Escalate); role-specific blocks (Release Protocol, Review Protocol, Story/Bug/Report formats, and so on) kept.
- Added Role lines to the three security agents; added a Trust Boundary to Loki; gave release-manager a standalone Completion section.
- Dropped Bash from technical-writer (least privilege; it executes nothing).
- Matrix: set the three 4.8-pinned security agents' alias to `n/a` (an alias must not be relied on to reach the pinned tier); de-dated and de-plan-specified the notes for portable team distribution; corrected the matrix view header to describe it as a derived view of the JSON source rather than the output of a shipped database pipeline.
- orchestrator-loop no longer re-lists the roster (it points at the matrix and README), removing a maintenance sync point.
- theme skill: documented Loki as the one intentional themed default, and noted that the corporate baseline ships with no `theme.json`.

### Added
- Plugin manifest: `author`, `homepage`, `repository`, and `keywords` fields.

### Removed
- A dead CSS class and a tool-attribution comment from the brand wordmark.

## [0.8.0] - 2026-08-26

### Added
- orchestrator-loop as the default operating mode: a trigger-rich description for best-effort auto-invocation, plus an opt-in per-user `SessionStart` hook (`skills/orchestrator-loop/session-start-framing.md`) for a deterministic always-on default, with no footprint forced on coworkers.

## [0.7.0] - 2026-08-26

### Added
- `wireup` skill: connects the roster to a specific project as a reviewed, merge-safe overlay - hooks and MCP servers into the project's own config (project-scoped, credentials as env-var references), LSP recommended rather than written since it is a plugin-only surface.

## [0.6.0] - 2026-08-26

### Changed
- Matrix cleanup: dropped the non-shipped orchestrator row and the unenforceable per-agent override column; purged stale slugs and operator-specific references; re-tiered business-analyst (Opus 5 to Sonnet).

### Added
- Agent audit fixes: scoped Bash and honest test reporting for the build/test agents; tool allowlists reconciled to each persona; trust-boundary sections on architect and business-analyst; removed the dated context-saturation hedge.

## [0.5.0] - 2026-08-26

### Changed
- Grouped-taxonomy agent slugs (developer-*, reviewer-*, testing-*, writer-*); restored the challenger as Loki.

### Added
- `designer` agent (product and UX design).

## [0.1.0] - [0.4.0] - 2026-08-26

- Initial specialist roster, the `model-routing` and `orchestrator-loop` skills, the generative `theme` skill, and the Switchboard rebrand with brand assets.
