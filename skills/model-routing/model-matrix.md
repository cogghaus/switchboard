# Model-Selection Matrix (hand-kept view of model-matrix.json - the source of truth)

Edit model-matrix.json, then hand-update this file to match (there is no generator yet; see ROADMAP `doctor`). See SKILL: model-routing.

## Hard rules (always win over the tables below)

1. Security / dual-use / red-team / pentest / exploit / vuln / credential work -> executor = claude-opus-4-8 (explicit full ID). Never Fable, Opus 5.5, Sonnet 5.5 or Opus 5: all of them run safety classifiers, and a flagged request silently re-runs on a fallback model inside a subagent.
2. The Agent tool accepts only aliases {fable, opus, sonnet, haiku}, and aliases move between model versions. Do not rely on an alias to reach claude-opus-4-8: pin it by full ID in a sub-agent definition's model: frontmatter.
3. trigger_model is the orchestrator tier, stored once in config so it is edited in one place. It is advice: nothing enforces it; set the session's model with /model.

## Aliases (checked 2026-11-23)

The 11 non-security agents carry the alias in frontmatter, so each follows the current model of its tier. Today the aliases resolve to:

| alias  | current model     |
|--------|-------------------|
| fable  | claude-fable-5-2  |
| opus   | claude-opus-5-5   |
| sonnet | claude-sonnet-5-5 |
| haiku  | claude-haiku-5-5  |

## Config

| key           | value           |
|---------------|-----------------|
| trigger_model | claude-opus-4-8 |
| version       | 2               |

## Task-tier routing

(rationale and surface_note per row live in model-matrix.json; read it when needed)

| task_tier                                  | default_model     | alias  |
|--------------------------------------------|-------------------|--------|
| design/architecture/spec                   | claude-fable-5-2  | fable  |
| spec review (spec-review skill)            | claude-fable-5-2  | fable  |
| hard reasoning or adversarial verification | claude-opus-5-5   | opus   |
| security/dual-use                          | claude-opus-4-8   | n/a    |
| large mechanical implementation            | claude-sonnet-5-5 | sonnet |
| utility lookups                            | claude-haiku-5-5  | haiku  |
| long parallel multi-agent orchestration    | claude-fable-5-2  | fable  |
| brainstorm/lateral/ambiguity               | claude-fable-5-2  | fable  |
| docs/writing                               | claude-sonnet-5-5 | sonnet |
| code review                                | claude-opus-5-5   | opus   |
| simple/CRUD implementation                 | claude-sonnet-5-5 | sonnet |

Note: the security/dual-use tier is agent-definition-only (see hard rule 2).

## Per-agent defaults

`frontmatter` is what the agent file's `model:` line holds.

| emoji | agent_id           | display_name       | resolves to       | frontmatter     |
|-------|--------------------|--------------------|-------------------|-----------------|
| 🛡️    | reviewer-security  | Security Reviewer  | claude-opus-4-8   | claude-opus-4-8 |
| 💀    | testing-red-team   | Red Team Lead      | claude-opus-4-8   | claude-opus-4-8 |
| ⚡    | testing-pentester  | Infra Pentester    | claude-opus-4-8   | claude-opus-4-8 |
| 🔨    | developer-frontend | Frontend Developer | claude-sonnet-5-5 | sonnet          |
| 🔥    | developer-backend  | Backend Developer  | claude-sonnet-5-5 | sonnet          |
| 🧪    | testing-qa         | QA Engineer        | claude-sonnet-5-5 | sonnet          |
| ⚖️    | reviewer-code      | Code Reviewer      | claude-opus-5-5   | opus            |
| 🧭    | reviewer-ux        | UX Reviewer        | claude-opus-5-5   | opus            |
| 🏛️    | architect          | Architect          | claude-fable-5-2  | fable           |
| 🎨    | designer           | Designer           | claude-fable-5-2  | fable           |
| 🔮    | business-analyst   | Business Analyst   | claude-sonnet-5-5 | sonnet          |
| 📜    | writer-technical   | Technical Writer   | claude-sonnet-5-5 | sonnet          |
| 📯    | release-manager    | Release Manager    | claude-sonnet-5-5 | sonnet          |
| 🎭    | loki               | Loki               | claude-fable-5-2  | fable           |

reviewer-security's pin is kept pending a comparison of one real review on Opus 4.8 against Opus 5.5: the pin trades some review quality for predictability, and the owner will test whether it matters.

## Notes
- Model surfaces and why aliases: a sub-agent definition's model: frontmatter accepts either an alias or a full model ID; the live Agent tool takes only aliases {fable, opus, sonnet, haiku}. The 11 non-security agents use the alias in frontmatter, so each follows the current model of its tier and a new generation needs no edit to their files (the tables above record what each alias resolves to today). The three security agents keep the explicit full ID claude-opus-4-8, because an alias can move to a classifier-carrying tier and a security pin must not.
- Security enforcement is by ROUTING, not a per-agent override column. Hand security / dual-use / red-team / pentest / exploit / vuln / credential work to the security-tier agents (reviewer-security, testing-red-team, testing-pentester), which are pinned to claude-opus-4-8 via full-ID frontmatter. A plugin agent's model is fixed at definition time and cannot self-switch mid-task, so there is no enforceable per-agent override; the routing decision is the control.
- Frontier-tier allowance discipline: the frontier tier (Fable) draws down its allowance faster than Opus and is subject to plan caps (exact rates are plan-specific). Reserve it for tiers where its ambiguity/design/orchestration strength compounds (design/spec, long orchestration, brainstorm, architect, designer, loki). Do not route mechanical or logic-bound work to it.
- Safety classifiers and fallback (Claude Code model-config doc, last verified 2026-10-08 for Fable 5.1; not yet re-verified for Fable 5.2): Fable 5.1, Fable 5, Opus 5.5, Sonnet 5.5 and Opus 5 run safety classifiers that mostly flag cybersecurity and biology content. Fable 5.1, Fable 5 and Opus 5.5 re-run cyber-flagged requests on Opus 4.8 and bio-flagged ones on Opus 5; Opus 5 re-runs cyber on Opus 4.8 and refuses bio; Sonnet 5.5 re-runs cyber on Sonnet 5 and refuses bio. After a fallback the session stays on the fallback model until /model. Inside a subagent there is no prompt: the flagged request silently re-runs on the fallback. switchModelsOnFlag=false makes the main session ask instead. Opus 4.8 is documented as the fallback target, not as a classifier source. Ordinary coding content is not a documented trigger; code-heavy tiers sit on Opus 5.5 or Sonnet for cost, not to dodge a swap. Fable 5.2 is assumed to behave like Fable 5.1 until the doc is re-read.
- trigger_model is stored once in config so the orchestrator tier is edited in one place; if later moved to claude-fable-5-2, keep all security execution inside 4.8-pinned subagents so the orchestrator's own flag-prone message volume stays near zero. It is advice only: nothing enforces it, and the main session's model is set with /model.
- Fast mode (Opus, toggled with /fast) fits latency-sensitive quality gates (code review) and high-throughput reasoning passes.
- Destructive schema/migration changes: the backend developer (developer-backend) must escalate the design decision to a capable tier and follow backup-first, manual-SQL, data-loss-warning policy before execution, regardless of its Sonnet default.
- Pin by full ID only where the guarantee matters (the three security agents, claude-opus-4-8); everywhere else the alias in frontmatter is intended, so the roster tracks the current model of each tier.
