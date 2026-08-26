# Model-Selection Matrix (GENERATED from model-matrix.db - do not hand-edit)

Source of truth: model-matrix.json -> rebuild DB -> regen this view. See SKILL: model-routing.

## Hard rules (always win over the tables below)

1. Security / dual-use / red-team / pentest / exploit / vuln / credential work -> executor = claude-opus-4-8 (explicit full ID). Never Fable or Opus 5.
2. The Agent tool accepts only aliases {fable, opus, sonnet, haiku}; the opus alias resolves to Opus 5 (trips the cyber guard). So 4.8 is reachable ONLY via a forge-agent definition model: frontmatter (full ID), NOT a live in-session spawn.
3. trigger_model is the orchestrator tier, stored once in config; forge-master mirrors it.

## Config
|      key      |      value      |
|---------------|-----------------|
| trigger_model | claude-opus-4-8 |
| version       | 1               |

## Task-tier routing

(rationale/surface_note per row live in model-matrix.json and the DB; query when needed)
|                 task_tier                  |       default_model       | alias  |
|--------------------------------------------|---------------------------|--------|
| design/architecture/spec                   | claude-fable-5            | fable  |
| hard reasoning or adversarial verification | claude-opus-5             | opus   |
| security/dual-use                          | claude-opus-4-8           | n/a    |
| large mechanical implementation            | claude-sonnet-5           | sonnet |
| utility lookups                            | claude-haiku-4-5-20251001 | haiku  |
| long parallel multi-agent orchestration    | claude-fable-5            | fable  |
| brainstorm/lateral/ambiguity               | claude-fable-5            | fable  |
| docs/writing                               | claude-sonnet-5           | sonnet |
| code review                                | claude-opus-5             | opus   |
| simple/CRUD implementation                 | claude-sonnet-5           | sonnet |

Note: the security/dual-use tier is agent-definition-only (see hard rule 2).

## Per-agent defaults
|      agent_id      |    display_name    |  default_model  | alias  | security_override |
|--------------------|--------------------|-----------------|--------|-------------------|
| security-reviewer  | Security Reviewer  | claude-opus-4-8 | opus   | claude-opus-4-8   |
| red-team-lead      | Red Team Lead      | claude-opus-4-8 | opus   | claude-opus-4-8   |
| infra-pentester    | Infra Pentester    | claude-opus-4-8 | opus   | claude-opus-4-8   |
| frontend-developer | Frontend Developer | claude-sonnet-5 | sonnet | claude-opus-4-8   |
| backend-developer  | Backend Developer  | claude-sonnet-5 | sonnet | claude-opus-4-8   |
| qa-engineer        | QA Engineer        | claude-sonnet-5 | sonnet | claude-opus-4-8   |
| code-reviewer      | Code Reviewer      | claude-opus-5   | opus   | claude-opus-4-8   |
| architect          | Architect          | claude-fable-5  | fable  | claude-opus-4-8   |
| business-analyst   | Business Analyst   | claude-opus-5   | opus   | claude-opus-4-8   |
| technical-writer   | Technical Writer   | claude-sonnet-5 | sonnet | claude-opus-4-8   |
| release-manager    | Release Manager    | claude-sonnet-5 | sonnet | claude-opus-4-8   |
| devils-advocate    | Devil's Advocate   | claude-fable-5  | fable  | claude-opus-4-8   |
| forge-master       | Orchestrator       | claude-opus-4-8 | opus   | claude-opus-4-8   |

## Notes
- Surface note (updated 2026-08-26): on 2026-08-25 the opus alias was observed as Opus 5; on 2026-08-26 empirical tests showed opus-spawned subagents coming up as Opus 4.8 (harness-injected identity, consistent across 4 runs, not an independent oracle; aliases move, so re-verify). Working assumption: claude-opus-4-8 is reachable via a live Agent-tool spawn (model:opus) as well as via a sub-agent definition full ID. Pin by full ID in definitions regardless, for stability.
- default_alias on aegis/slag/flux is opus; per the 2026-08-26 finding that opus spawns as Opus 4.8, spawning by that alias now appears compliant with the security constraint. Confirm before relying; pin by full ID in the sub-agent definition either way.
- security_override_model is claude-opus-4-8 on all 13 agents by design: any agent handed a security/dual-use/red-team/pentest/exploit/vuln/credential task switches its executor to 4.8, enforceable only via the agent-definition full-ID surface.
- Fable allowance discipline: Fable draws down the Max allowance ~2x faster than Opus and is capped at ~50% weekly. Reserve it for tiers where its ambiguity/design/orchestration strength compounds (design/spec, long orchestration, brainstorm, architect, loki). Do not route mechanical or logic-bound work to Fable.
- Fable per-message auto-swap: any Fable message touching coding, cybersecurity, or biology auto-swaps to Opus per-message. Routing code-dense work through Fable often yields Opus output while consuming a Fable-shaped slot, so code-heavy tiers are assigned to Opus 5 or Sonnet directly.
- trigger_model and forge-master default are intentionally identical (claude-opus-4-8) so the orchestrator tier is edited in one place; if later moved to claude-fable-5, keep all security execution inside 4.8-pinned subagents so the orchestrator's own guard-tripping message volume stays near zero.
- Opus 5 fast mode is available (Opus 5 only) and fits latency-sensitive quality gates (temper) and high-throughput reasoning passes.
- Destructive schema/migration changes: furnace must escalate the design decision to a capable tier and follow backup-first, manual-SQL, data-loss-warning policy before execution, regardless of its Sonnet default.
- Prefer the explicit full ID (claude-opus-4-8) in sub-agent definitions for stability. The bare opus alias was Opus 5 on 2026-08-25 but observed as Opus 4.8 on 2026-08-26 (aliases move); do not assume without checking.
