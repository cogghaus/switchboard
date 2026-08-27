# Install and configuration

## Install locally (no marketplace)

Point Claude Code at the plugin directory:

```
claude --plugin-dir <path-to-switchboard>
```

That loads the roster and skills for the session. No marketplace or shared config is needed to try it. Confirm what loaded:

```
claude --plugin-dir <path-to-switchboard> plugin details switchboard
```

You should see 13 agents and 4 skills.

## Share it with a team

Two ways to distribute:

- **Clone and `--plugin-dir`.** Each person clones the repo and runs Claude Code with `--plugin-dir` pointing at their clone. Simplest for a small team.
- **Marketplace.** Add the repo to a Claude Code marketplace and install by name. Better for wider distribution and updates.

Either way, the plugin is portable: it ships no project-specific config and no always-on hooks, so enabling it never reshapes an unrelated session on its own.

## Make orchestrator-loop your default

The `orchestrator-loop` skill auto-invokes on substantial tasks, but that is best-effort. For a deterministic always-on default, add the opt-in per-user `SessionStart` hook documented in `skills/orchestrator-loop/SKILL.md` (there is a POSIX form and a Windows form). It injects a short orchestrator framing at the start of each of your sessions and is per-user, so it never affects coworkers who install the plugin. Remove the hook entry to turn it off.

## See which agent is working

Switchboard leads every delegation and report with the specialist's emoji (🔥 Backend Developer, 🧪 QA Engineer, and so on), so which agent or skill is doing the work is visible in the transcript by default - this convention is built into the orchestrator loop and needs no setup.

For a live indicator in Claude Code's subagent panel as agents run, enable the optional status-line script:

1. Ensure `jq` is installed (the script uses it).
2. Point `subagentStatusLine` in your own `~/.claude/settings.json` at the shipped script, replacing `<SWITCHBOARD>` with your installed plugin path:

```json
{
  "subagentStatusLine": "<SWITCHBOARD>/scripts/subagent-status.sh"
}
```

The panel then shows each running sub-agent with its emoji, for example `🔥 developer-backend · running`. This is per-user and optional; the plugin ships it off by default. Status-line behavior in the IDE surfaces is not yet documented, so treat the live panel as best-effort - the transcript announcements above always work.

## Theme the roster (optional)

Run the `theme` skill to reskin the roster to a naming theme. It asks whether to keep the plain corporate default or apply a custom theme; for custom, you name any subject (a show, game, universe, or motif) and each role is renamed to a fitting character. Theming is cosmetic - names and at most one flavor line per agent - and never changes an agent's tools, model, or safety instructions. The value `corporate` restores the shipped defaults. See `skills/theme/SKILL.md`.

## Wire it into a project (optional)

Run the `wireup` skill inside a specific codebase to connect the roster to that project's toolchain, as a reviewed, merge-safe overlay on the project's own config:

- **Hooks** are written to the project's own settings and enforce its conventions (formatter, linter, tests, guards). They are project-scoped, so they also apply to delegated sub-agents.
- **MCP servers** are written to the project's own config to connect agents to its ecosystem (code index, issue tracker, CI, docs, database). Credentials are always referenced as environment variables, never inlined.
- **Code intelligence (LSP)** is recommended rather than written, because that surface is plugin-only; `wireup` points you at a prebuilt LSP plugin, a companion per-stack plugin, or a fork.

Nothing is written without your review, and re-running `wireup` changes nothing already in place. See `skills/wireup/SKILL.md`.

## Configuration surfaces at a glance

| Surface | Where | Set by |
|---|---|---|
| Which model each agent uses | `agents/<name>.md` frontmatter, per the matrix | edit the file / the matrix |
| Model routing policy | `skills/model-routing/model-matrix.json` (source) + `.md` (view) | edit the JSON, regenerate the view |
| Agent names / theme | `agents/<name>.md` + `theme.json` | the `theme` skill |
| Always-on orchestrator mode | your own `SessionStart` hook | opt-in, see above |
| Project hooks / MCP / LSP | the project's own config | the `wireup` skill |

## See also

- [usage.md](usage.md) - the orchestrator workflow.
- [agents.md](agents.md) - the specialist roster.
- [skills.md](skills.md) - the skills that drive the roster.
