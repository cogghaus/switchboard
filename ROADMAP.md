# Roadmap

Switchboard is the **portable orchestration layer**: a roster of specialist sub-agents plus routing and operating skills that work in any Claude Code session. Shipped history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks open and future work.

## Open

- **Broaden `wireup` heuristics.** The detect-and-propose logic per stack can grow as real projects exercise the skill.
- **Measure orchestrator-loop fire rate.** Empirical auto-invocation measurement via `claude plugin eval` (a `tool_used: Skill` ablation grader) is blocked until plugin eval leaves early access for this org; re-run it and tighten the description from the data.
- **LSP delivery choice.** Decide per team and stack: a prebuilt LSP plugin, a companion per-stack plugin, or a fork. `wireup` recommends rather than writes, keeping the core portable.
- **Optional polish.** Slash commands for common flows; wire the icon in as a favicon / social-preview once there is a docs site.

## Before making the repo public

- Full documentation (usage, each agent, each skill, install, configuration).
- A full repo secret-and-issue scan before the repo goes public.
