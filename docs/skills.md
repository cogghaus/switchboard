# Skills Reference

Skills are how you drive the Switchboard roster. Some auto-invoke - Claude reads a skill's
description and decides, best-effort, whether the current task calls for it - and some you call
explicitly by name with `/skill-name`. Switchboard ships four: `orchestrator-loop` (the default
operating loop), `model-routing` (which model runs which task), `theme` (reskin the roster's
names), and `wireup` (connect the roster to a specific project's config). This page is the
newcomer reference for each.

## orchestrator-loop

The default operating loop for substantial work: frame the goal, decide direct-vs-delegate, route
each piece to the right specialist at the right model, review what comes back, and report.

The loop, run for every substantial task:

1. **Understand and frame** - restate the goal in one line, to catch a bad framing before executing.
2. **Decide direct vs. delegate** - small and quick work is done directly; large, mechanical,
   parallelizable, or specialized work is delegated.
3. **Route** - consult the `model-routing` skill to pick the model and the specialist whose role fits.
4. **Delegate** with a clear spec (goal, input paths, constraints, acceptance criteria), forbidding
   re-delegation.
5. **Review** - never relay a sub-agent's output unread; high-stakes or dual-use work gets a second
   agent to verify.
6. **Report** - plan, then did (one line per action), then results and outstanding.

**Invocation:** auto-invokes on substantial development tasks (building a feature, cross-file bug
fixes, refactoring, codebase research, planning, multi-step or delegatable work) - this is
model-driven and best-effort, so it is not guaranteed to fire every time. It can also be entered
explicitly with `/orchestrator-loop`.

**Making it the standing default:** auto-invocation alone isn't a guarantee. If you want the loop
to be your operating mode on every session, add a per-user `SessionStart` hook to your own
`~/.claude/settings.json` (or a project's `.claude/settings.json`) that injects the framing text
shipped in `session-start-framing.md` (next to the skill's `SKILL.md`) - a POSIX (`cat`) and a
Windows (`type`) command form are both provided in the SKILL.md, with `<SWITCHBOARD>` swapped for
your installed plugin path. This is opt-in and per-user: the shipped plugin adds no always-on hook
by design, so installing it never reframes someone else's session. Merge the hook into any
existing `hooks` block rather than replacing it; removing the entry turns it off.

**Output:** no artifact of its own - it shapes how the session behaves (framing, delegation
choices, and the final plan/did/results report).

See `skills/orchestrator-loop/SKILL.md` for the full text, and `session-start-framing.md` for the
exact injected framing.

## model-routing

The model-selection matrix: which model a given task or agent should run on, so capable tiers are
spent where quality compounds (design, ambiguity, orchestration, review) and cheap tiers absorb
volume (large mechanical work, quick lookups). Security and dual-use work is pinned to
`claude-opus-4-8` by explicit full model ID in the agent's definition, overriding every table -
this is a hard rule, not a default that can be routed around.

Two files carry the matrix:

- `model-matrix.json` - the machine-readable source of truth (tiers, per-agent defaults, the
  trigger model).
- `model-matrix.md` - the human-readable view generated from it, with the hard rules on top and a
  per-tier and per-agent table below.

To change routing, edit `model-matrix.json` first, then update `model-matrix.md` to match - the
JSON is the single source for each agent's `model:` frontmatter.

**Invocation:** consulted, not run standalone - the `orchestrator-loop` skill (and you, before
spawning any agent) reads `model-matrix.md` as part of routing step 3.

**Output:** no artifact of its own - it informs which model alias or full model ID gets used for a
spawned agent.

See `skills/model-routing/SKILL.md` for the full text.

## theme

Reskins the Switchboard agent roster to a naming theme (a show, game, universe, or any motif),
without changing what any agent does.

**The flow:**

1. Ask the user: keep the default corporate roster, or apply a custom theme? If custom, ask for a
   subject.
2. Map each role to a name from that subject that fits the role's function (a guardian for the
   security reviewer, an adversary for the red-teamer, and so on).
3. Present the proposed role -> themed-name table for the user to veto or swap before anything is
   written.
4. On approval, apply it: update each agent file's `name:` frontmatter and `# H1` title, optionally
   add one short flavor line, then keep the model matrix, `README.md`, and `theme.json` (the
   revertible record of the applied theme and mapping) consistent with the new names.

Reskinning is strictly cosmetic - names, and at most one flavor line, per agent. It never touches
`tools`, `model`, `description`, or any functional or safety instruction; the security agents keep
`model: claude-opus-4-8` under whatever name they're given. The one intentional exception to the
plain corporate baseline is the challenger role, which ships already named **Loki** rather than a
neutral role word.

**Invocation:** by name, `/theme` - it's a deliberate, conversational, approval-gated action, not
something that auto-fires mid-task.

**Output:** edits to each `agents/*.md` file's `name:`/`# H1` (and optional flavor line),
`skills/model-routing/model-matrix.json` and `.md` (display names), `README.md` (roster list), and
`theme.json` at the plugin root recording the applied theme for revertibility.

See `skills/theme/SKILL.md` for the full text.

## wireup

Connects the portable Switchboard roster to a specific project by writing a reviewed, merge-safe
overlay into the **project's own config** - never into the shipped plugin, since a plugin's
sub-agents are forbidden from declaring `hooks`, `mcpServers`, or `permissionMode` themselves.
Project-level hooks and MCP servers apply to the whole session including delegated Agent-tool
subagents, which is exactly the roster wireup is trying to sharpen.

Three surfaces, only two of which wireup writes:

- **Hooks** -> `<project>/.claude/settings.json` (project-scoped, applies to subagents too).
- **MCP servers** -> `<project>/.mcp.json` (project-scoped, committed and shared with the team;
  every credential is referenced as an `${ENV_VAR}`, never inlined as a real token).
- **LSP / code intelligence** -> `.lsp.json`, a plugin-only surface that cannot be set per project.
  Wireup recommends options (a prebuilt LSP plugin, a companion stack-specific plugin, or your own
  fork) rather than silently writing it.

**The flow:** detect the stack (package/build files, test runner, CI, git remote host, infra
config) -> propose an overlay for each surface -> get explicit per-surface approval (hooks execute
commands and MCP servers reach external services, so nothing is written until approved) -> merge
into existing config without clobbering anything already there -> verify the result (JSON parses,
MCP server reachable) and report what was written and what was skipped. Running wireup twice on an
already-wired project changes nothing the second time.

**Invocation:** by name, `/wireup` - run once per codebase, or again when the toolchain changes.

**Output:** edits to `<project>/.claude/settings.json` (hooks) and `<project>/.mcp.json` (MCP
servers), plus hook scripts under `<project>/.claude/hooks/` when a hook needs one; an LSP
recommendation only, never a silent `.lsp.json` write.

See `skills/wireup/SKILL.md` for the full text.
