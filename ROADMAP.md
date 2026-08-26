# Roadmap

Switchboard today is the **portable orchestration layer**: a roster of specialist sub-agents plus routing and operating skills that work in any Claude Code session. The next layer is **environment integration** - connecting the roster to a specific codebase and toolchain.

Because environment integration is stack- and codebase-specific, the open design question for each item below is: **bundle it, make it configurable, or ship it as a companion plugin per stack** - so the core stays portable enough to share across a team on different codebases.

## Environment integration (next)

- **LSP servers** - give the build and review agents real code intelligence (go-to-definition, find-references, diagnostics, safe rename) instead of text search. Bundle the language servers for the stacks the team actually uses (e.g. TypeScript/JS, Python). Language-specific.
- **MCP servers** - connect agents to the codebase's ecosystem: the code index, issue tracker, CI, internal docs, a database. Where agents get real tools and context beyond files. Org/codebase-specific.
- **Hooks** - enforce the project's conventions automatically: run the formatter/linter/tests after edits (PostToolUse), guard unsafe operations (PreToolUse), auto version-bump, and similar. Command-specific to the project.

## Also open

- Make `orchestrator-loop` reliably the *invoked default* (broad-trigger skill tuning; validate it fires ambiently rather than being ignored).
- Optional polish: slash commands for common flows; wire the icon in as a favicon / social-preview once there is a docs site.

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
