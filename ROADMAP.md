# Roadmap

Switchboard today is the **portable orchestration layer**: a roster of specialist sub-agents plus routing and operating skills that work in any Claude Code session. The next layer is **environment integration** - connecting the roster to a specific codebase and toolchain.

Because environment integration is stack- and codebase-specific, the open design question for each item below is: **bundle it, make it configurable, or ship it as a companion plugin per stack** - so the core stays portable enough to share across a team on different codebases.

## Environment integration (next)

- **LSP servers** - give the build and review agents real code intelligence (go-to-definition, find-references, diagnostics, safe rename) instead of text search. Bundle the language servers for the stacks the team actually uses (e.g. TypeScript/JS, Python). Language-specific.
- **MCP servers** - connect agents to the codebase's ecosystem: the code index, issue tracker, CI, internal docs, a database. Where agents get real tools and context beyond files. Org/codebase-specific.
- **Hooks** - enforce the project's conventions automatically: run the formatter/linter/tests after edits (PostToolUse), guard unsafe operations (PreToolUse), auto version-bump, and similar. Command-specific to the project.

## Also open

- Make `orchestrator-loop` reliably the *invoked default* (broad-trigger skill tuning; validate it fires ambiently rather than being ignored).
- Generalize the bundled model-matrix notes (remove operator-specific dates and plan-allowance language) for clean team distribution.
- Optional polish: slash commands for common flows; wire the icon in as a favicon / social-preview once there is a docs site.
