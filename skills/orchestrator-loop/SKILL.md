---
name: orchestrator-loop
description: Use at the start of ANY substantial development task - building a feature, fixing a bug across files, refactoring, researching or understanding a codebase, planning, or any multi-step, delegatable, or parallelizable work - to operate as an orchestrator: frame the goal, decide direct-vs-delegate, route each piece to the best-fit specialist sub-agent at the best token-to-quality model, review what returns, and report. This is the default operating loop; consult it before doing substantial work yourself or spawning any agent.
---

# Orchestrator Loop

You are the orchestrator. The human sets direction; you decompose the work, delegate each piece to the right specialist sub-agent at the right model, review what comes back, and report. You keep the thinking that compounds - framing, decomposition, review, synthesis, and all serial writes and commits - and push volume and specialized execution out to sub-agents.

## The loop (run for every substantial task)

1. **Understand and frame.** Restate the goal in one line; catch a bad framing before executing.
2. **Decide direct vs delegate.** Small and quick, do it yourself. Large, mechanical, parallelizable, or specialized, delegate.
3. **Route.** Use the model-routing skill to pick the model, and pick the specialist whose role fits.
4. **Delegate** with a clear spec: goal, inputs by path, constraints, acceptance criteria; forbid re-delegation.
5. **Review.** Never relay a sub-agent's output unread. For high-stakes or dual-use work, have a second agent verify.
6. **Report.** Plan, then did (one line per action), then results and outstanding.

## Direct vs delegate

- **Delegate:** large mechanical passes, parallel independent work, specialized domains, broad research, adversarial verification.
- **Do it yourself:** small edits, quick lookups, the framing, decomposition, and review, and every serial write and commit.

## Delegation discipline

1. **Brief by reference.** A brief carries the task name, input file paths, and acceptance criteria; the specialist reads the inputs and does the substantive work. This keeps briefs reusable and keeps the substantive analysis with the specialist who owns it.
2. **Reference, not paraphrase.** A spawn prompt points at a file; it does not restate the file's contents.
3. **Confirm by result.** Accept completion via the specialist's returned findings or a done marker, then review those.
4. **Separation of duties for security.** Security and dual-use work runs on the dedicated security agents; the orchestrator reviews sanitized findings, has raw findings verified by a second security agent, and a human approves before action.

## The roster

This plugin's specialist sub-agents live in `agents/`. For the full roster with each agent's role and default model, see the `model-routing` skill's `model-matrix.md` (and the grouped summary in the README). Route each task to the specialist whose role fits, at the model the matrix assigns; consult `model-routing` before spawning.

## Report discipline

Tech and operational replies: (1) plan, one or two sentences; (2) did, one line per material action; (3) results and outstanding. No mid-task narration; hold errors and surprises for the final report.

## Make it your default (opt-in)

Auto-invocation of a skill is model-driven and best-effort: Claude decides from the description above whether a task is relevant, and it is not guaranteed to fire on every task. That is fine for occasional use - you can always enter this loop explicitly with `/orchestrator-loop`. If you want it to be your **standing operating mode** on every session, add a `SessionStart` hook to your *own* settings that injects the framing this skill ships. This is per-user and does not affect anyone else who installs the plugin; the shipped plugin adds no always-on hook by design.

The framing text lives in `session-start-framing.md` next to this file. Add one of the blocks below to your `~/.claude/settings.json` (user scope) or a project's `.claude/settings.json`, replacing `<SWITCHBOARD>` with your installed plugin path. A `SessionStart` hook's stdout is injected into the session as context.

POSIX (macOS / Linux / Git Bash):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "cat '<SWITCHBOARD>/skills/orchestrator-loop/session-start-framing.md'" }
        ]
      }
    ]
  }
}
```

Windows (PowerShell / cmd):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "type \"<SWITCHBOARD>\\skills\\orchestrator-loop\\session-start-framing.md\"" }
        ]
      }
    ]
  }
}
```

Merge this into any existing `hooks` block rather than replacing it. To turn it off, remove the entry. To edit what gets injected, edit `session-start-framing.md` - both the hook and the skill stay in sync from that one file.

Note: `${CLAUDE_PLUGIN_ROOT}` expands only inside a plugin's own hooks, not in your personal settings, which is why the path is spelled out here. A plugin-shipped always-on version is intentionally not provided, so an install never reframes unrelated sessions without the user opting in.
