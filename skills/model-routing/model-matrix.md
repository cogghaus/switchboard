# Model-Selection Matrix (derived view of model-matrix.json - the source of truth)

Edit model-matrix.json, then regenerate or hand-update this file to match. See SKILL: model-routing.

## Hard rules (always win over the tables below)

1. Security / dual-use / red-team / pentest / exploit / vuln / credential work -> executor = claude-opus-4-8 (explicit full ID). Never Fable or Opus 5.
2. The Agent tool accepts only aliases {fable, opus, sonnet, haiku}, and aliases move between model versions. Do not rely on an alias to reach claude-opus-4-8: pin it by full ID in a sub-agent definition's model: frontmatter.
3. trigger_model is the orchestrator tier, stored once in config so it is edited in one place.

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
| emoji |      agent_id      |    display_name    |  default_model  | alias  |
|-------|--------------------|--------------------|-----------------|--------|
| 🛡️    | reviewer-security  | Security Reviewer  | claude-opus-4-8 | n/a    |
| 💀     | testing-red-team   | Red Team Lead      | claude-opus-4-8 | n/a    |
| ⚡     | testing-pentester  | Infra Pentester    | claude-opus-4-8 | n/a    |
| 🔨     | developer-frontend | Frontend Developer | claude-sonnet-5 | sonnet |
| 🔥     | developer-backend  | Backend Developer  | claude-sonnet-5 | sonnet |
| 🧪     | testing-qa         | QA Engineer        | claude-sonnet-5 | sonnet |
| ⚖️    | reviewer-code      | Code Reviewer      | claude-opus-5   | opus   |
| 🏛️    | architect          | Architect          | claude-fable-5  | fable  |
| 🎨     | designer           | Designer           | claude-fable-5  | fable  |
| 🔮     | business-analyst   | Business Analyst   | claude-sonnet-5 | sonnet |
| 📜     | writer-technical   | Technical Writer   | claude-sonnet-5 | sonnet |
| 📯     | release-manager    | Release Manager    | claude-sonnet-5 | sonnet |
| 🎭     | loki               | Loki               | claude-fable-5  | fable  |

## Notes
- Model surfaces: a sub-agent definition's model: frontmatter accepts a full model ID; the live Agent tool takes only aliases {fable, opus, sonnet, haiku}. Aliases can move between model versions and are not guaranteed to resolve to a specific model, so never rely on an alias to reach a security-critical tier - pin claude-opus-4-8 by full ID in the definition and re-verify periodically.
- Security enforcement is by ROUTING, not a per-agent override column. Hand security / dual-use / red-team / pentest / exploit / vuln / credential work to the security-tier agents (reviewer-security, testing-red-team, testing-pentester), which are pinned to claude-opus-4-8 via full-ID frontmatter. A plugin agent's model is fixed at definition time and cannot self-switch mid-task, so there is no enforceable per-agent override; the routing decision is the control.
- Frontier-tier allowance discipline: the frontier tier (Fable) draws down its allowance faster than Opus and is subject to plan caps (exact rates are plan-specific). Reserve it for tiers where its ambiguity/design/orchestration strength compounds (design/spec, long orchestration, brainstorm, architect, designer, loki). Do not route mechanical or logic-bound work to it.
- Frontier per-message auto-swap: any frontier-tier (Fable) message touching coding, cybersecurity, or biology auto-swaps to Opus per-message. Routing code-dense work through it often yields Opus output while consuming a frontier-shaped slot, so code-heavy tiers are assigned to Opus 5 or Sonnet directly.
- trigger_model is stored once in config so the orchestrator tier is edited in one place; if later moved to claude-fable-5, keep all security execution inside 4.8-pinned subagents so the orchestrator's own guard-tripping message volume stays near zero.
- Opus 5 fast mode is available (Opus 5 only) and fits latency-sensitive quality gates (code review) and high-throughput reasoning passes.
- Destructive schema/migration changes: the backend developer (developer-backend) must escalate the design decision to a capable tier and follow backup-first, manual-SQL, data-loss-warning policy before execution, regardless of its Sonnet default.
- Prefer the explicit full ID (claude-opus-4-8) in sub-agent definitions for stability; do not assume an alias resolves to a given version without checking.
