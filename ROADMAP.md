# Roadmap

Switchboard today is the **portable orchestration layer**: a roster of specialist sub-agents plus routing and operating skills that work in any Claude Code session. The next layer is **environment integration** - connecting the roster to a specific codebase and toolchain.

Because environment integration is stack- and codebase-specific, the design question for each item was: **bundle it, make it configurable, or ship it as a companion plugin per stack** - so the core stays portable enough to share across a team on different codebases. The `wireup` skill (v0.7) answers this per surface.

## Environment integration (shipped as `wireup`, v0.7)

The `wireup` skill wires the roster into a specific project as a reviewed, merge-safe overlay on the project's own config - keeping the shipped plugin portable:

- **Hooks** -> written to `<project>/.claude/settings.json`. Enforce the project's conventions automatically (formatter/linter/tests on PostToolUse, guards on PreToolUse). Project-scoped, so they apply to delegated subagents too.
- **MCP servers** -> written to `<project>/.mcp.json`. Connect agents to the codebase's ecosystem (code index, issue tracker, CI, docs, DB). Committed and value-free (every credential an `${ENV_VAR}` reference).
- **LSP / code intelligence** -> recommended, not silently written, because `.lsp.json` is a plugin-only surface. wireup points the user to a prebuilt LSP plugin, a companion per-stack plugin, or their own fork - so the shared core never becomes stack-specific.

Remaining polish: detect-and-propose heuristics per stack could be broadened as real projects exercise the skill.

## Also open

- Optional polish: slash commands for common flows; wire the icon in as a favicon / social-preview once there is a docs site.

## Default operating mode (shipped, v0.8)

`orchestrator-loop` is tuned for best-effort auto-invocation (trigger-rich description) and ships an opt-in `SessionStart` hook (`skills/orchestrator-loop/session-start-framing.md` + documented per-user settings block) for a deterministic always-on default, with no always-on footprint forced on coworkers. Findings that shaped this: a plugin skill's auto-invoke is model-driven and probabilistic (not guaranteed); a plugin cannot ship an always-loaded CLAUDE.md; the only deterministic always-on lever is a SessionStart hook. Open: empirical fire-rate measurement via `claude plugin eval` (a `tool_used: Skill` ablation grader) is blocked here because plugin eval is early-access-gated for this org - re-run the measurement once it is enabled and tighten the description from the data.

## Agent quality (DONE, v0.6)

The 2026-08-26 design audit is closed:

- Build/test agents (developer-backend, developer-frontend, testing-qa) granted scoped Bash to run and verify their own output, with usage guidance and honest "ran the tests, here is the result" reporting instead of asserting a pass.
- Security enforcement moved to routing - security-tagged work goes to the 4.8 security agents - and the unenforceable per-agent `security_override` matrix column dropped.
- Tool-allowlist tidy-ups: Glob added to testing-qa and business-analyst; Write added where an agent owns artifacts (testing-qa test files, business-analyst PRDs/stories); Grep/Glob/Edit added to writer-technical.
- Trust-boundary sections added to architect and business-analyst; the dated context-saturation escalation hedge removed from all agents.
- business-analyst re-tiered Opus 5 -> Sonnet; model-matrix notes generalized (operator-specific slugs, dates, and plan-allowance specifics removed) for clean team distribution.
- Release-manager reviewed and kept as-is: its protocol is outcome- and convention-driven, not keystroke dictation.

Naming themes (generative) shipped earlier as the `theme` skill: keep the default corporate roster or name any subject and each role is reskinned to a fitting character, function unchanged.

## Before making the repo public

- Full documentation (usage, each agent, each skill, install, configuration).
- Full top-down refactor.
- Full top-down efficiency pass.
- Full top-down quality pass.
- Full repo secret-and-issue scan (secrets, license, and anything else to rectify) before the repo goes public.
