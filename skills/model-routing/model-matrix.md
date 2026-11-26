# Model-Selection Matrix (hand-kept view of model-matrix.json - the source of truth)

Edit model-matrix.json, then hand-update this file to match (there is no generator yet; see ROADMAP `doctor`). See SKILL: model-routing.

## Hard rules (always win over the tables below)

1. Offensive security work (red team, pentest, exploit development) -> executor = claude-opus-4-8 (Opus 4.8), pinned by full ID: on the newer tiers nearly every such request would be flagged and run twice.
2. Defensive security review -> executor = claude-opus-5-5 (Opus 5.5), pinned by full ID. A flagged request re-runs on Opus 4.8 by itself and the next ones return to Opus 5.5. Keep fallback on automatic switching (the default unless switchModelsOnFlag is false or set to ask each time): in "ask each time" a flagged subagent fails instead.
3. Spawn every roster agent without a `model` argument. A model passed on the Agent call replaces the definition's model, pins included; the definition decides. Pass a model only to a non-roster agent (general-purpose, Explore), picked from the tables below.
4. The Agent tool takes only the aliases {fable, opus, sonnet, haiku}, and aliases move between model versions; a definition's model: frontmatter takes an alias or a full ID. Pin by full ID where the guarantee matters.

## Aliases (checked 2026-11-26)

Nine agents carry the alias in frontmatter, so each follows the current model of its tier. Today, on the Anthropic API, the aliases resolve to (in Claude apps gateway sessions `fable` is Fable 5 unless ANTHROPIC_DEFAULT_FABLE_MODEL is set; Bedrock and Foundry resolve aliases to older models):

| alias  | current model     |
|--------|-------------------|
| fable  | claude-fable-5-2  |
| opus   | claude-opus-5-5   |
| sonnet | claude-sonnet-5-5 |
| haiku  | claude-haiku-5-5  |

## Config

| key           | value           |
|---------------|-----------------|
| trigger_model | claude-opus-5-5 |
| version       | 2               |

## Task-tier routing

(rationale and surface_note per row live in model-matrix.json; read it when needed)

| task_tier                                  | default_model     | alias  |
|--------------------------------------------|-------------------|--------|
| design/architecture/spec                   | claude-fable-5-2  | fable  |
| spec review (spec-review skill)            | claude-fable-5-2  | fable  |
| hard reasoning or adversarial verification | claude-opus-5-5   | opus   |
| defensive security review                  | claude-opus-5-5   | n/a    |
| offensive security (red team, pentest)     | claude-opus-4-8   | n/a    |
| large mechanical implementation            | claude-sonnet-5-5 | sonnet |
| utility lookups                            | claude-haiku-5-5  | haiku  |
| long parallel multi-agent orchestration    | claude-fable-5-2  | fable  |
| brainstorm/lateral/ambiguity               | claude-fable-5-2  | fable  |
| docs/writing                               | claude-sonnet-5-5 | sonnet |
| code review                                | claude-opus-5-5   | opus   |
| simple/CRUD implementation                 | claude-sonnet-5-5 | sonnet |

Note: the two security tiers and code review run on agents pinned by full ID in their definitions; pass no model when spawning them (hard rules 3 and 4).

## Per-agent defaults

`frontmatter` is what the agent file's `model:` line holds.

| emoji | agent_id           | display_name       | resolves to       | frontmatter     |
|-------|--------------------|--------------------|-------------------|-----------------|
| 🛡️    | reviewer-security  | Security Reviewer  | claude-opus-5-5   | claude-opus-5-5 |
| 💀    | testing-red-team   | Red Team Lead      | claude-opus-4-8   | claude-opus-4-8 |
| ⚡    | testing-pentester  | Infra Pentester    | claude-opus-4-8   | claude-opus-4-8 |
| 🔨    | developer-frontend | Frontend Developer | claude-sonnet-5-5 | sonnet          |
| 🔥    | developer-backend  | Backend Developer  | claude-sonnet-5-5 | sonnet          |
| 🧪    | testing-qa         | QA Engineer        | claude-sonnet-5-5 | sonnet          |
| ⚖️    | reviewer-code      | Code Reviewer      | claude-opus-5-5   | claude-opus-5-5 |
| 🧭    | reviewer-ux        | UX Reviewer        | claude-opus-5-5   | claude-opus-5-5 |
| 🏛️    | architect          | Architect          | claude-fable-5-2  | fable           |
| 🎨    | designer           | Designer           | claude-fable-5-2  | fable           |
| 🔮    | business-analyst   | Business Analyst   | claude-sonnet-5-5 | sonnet          |
| 📜    | writer-technical   | Technical Writer   | claude-sonnet-5-5 | sonnet          |
| 📯    | release-manager    | Release Manager    | claude-sonnet-5-5 | sonnet          |
| 🎭    | loki               | Loki               | claude-fable-5-2  | fable           |

reviewer-security runs on Opus 5.5: a cyber-flagged request re-runs on Opus 4.8 automatically and later requests return to Opus 5.5. In the maintainer's own runs, 37 security reviews on Opus 5.5 or Fable 5.2 (about 2,000 turns) never fell back, and across 300+ reviewer runs on classifier-carrying models one fell back, automatically, for 15 turns, then returned to Opus 5.5. Loki runs once per spec and per significant design decision; its output is two or three short counterpoints, so volume and allowance cost stay small.

## Notes
- Model surfaces and why aliases: a sub-agent definition's model: frontmatter accepts either an alias or a full model ID; the live Agent tool takes only aliases {fable, opus, sonnet, haiku}. Nine agents use the alias in frontmatter (architect, designer, loki: fable; developer-backend, developer-frontend, testing-qa, business-analyst, writer-technical, release-manager: sonnet), so each follows the current model of its tier and a new generation needs no edit to their files (the tables above record what each alias resolves to today on the Anthropic API; in Claude apps gateway sessions fable is Fable 5 unless ANTHROPIC_DEFAULT_FABLE_MODEL is set; Bedrock and Foundry resolve aliases to older models). Five agents keep an explicit full ID instead. The two offensive agents (testing-red-team, testing-pentester) stay on claude-opus-4-8, because an alias can move to a classifier-carrying tier and on those tiers nearly every offensive request would be flagged and run twice. The three reviewers (reviewer-code, reviewer-ux, reviewer-security) are pinned by full ID claude-opus-5-5, an exception to the alias rule, for a different reason: an alias follows the parent session's model when the parent is the same family (Claude Code subagent docs, "Which version a model alias selects"), so under an Opus 4.8 main session `opus` would silently run the review gates on 4.8. The same exposure exists for any alias agent whose tier matches the main session: with a Fable main session the fable agents run on that session's Fable version, with a Sonnet main session the sonnet agents follow it; with the recommended Opus 5.5 main session neither occurs, but changing trigger_model changes what the alias agents run on.
- Security enforcement is by ROUTING, not a per-agent override column. Hand defensive security review to reviewer-security (pinned to claude-opus-5-5) and offensive work (red team, pentest, exploit development) to testing-red-team or testing-pentester (pinned to claude-opus-4-8), all via full-ID frontmatter. A plugin agent's model is fixed by its definition unless the spawn passes a model. The order for a subagent is: (1) the per-invocation model parameter on the Agent call (aliases only), (2) the definition's model field, (3) CLAUDE_CODE_SUBAGENT_MODEL, (4) the parent's model; a mod's agent.spawn hook model beats (1), and CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1 ignores (1) and (2). A model passed on the Agent call therefore replaces every pin, which is why hard rule 3 says to spawn roster agents with no model argument. Apart from a classifier fallback, an agent does not switch its own model mid-task, so there is no enforceable per-agent override; the routing decision is the control.
- Frontier-tier allowance discipline: the frontier tier (Fable) draws down its allowance faster than Opus and is subject to plan caps (exact rates are plan-specific). Reserve it for tiers where its ambiguity/design/orchestration strength compounds (design/spec, long orchestration, brainstorm, architect, designer, loki). Do not route mechanical or logic-bound work to it.
- Safety classifiers and fallback (Claude Code model-config and subagent docs, checked 2026-11-26): Fable models (5, 5.1, 5.2), Opus 5.5, Sonnet 5.5 and Opus 5 run safety classifiers that mostly flag cybersecurity and biology content. Fable models and Opus 5.5 re-run cyber-flagged requests on Opus 4.8 and bio-flagged ones on Opus 5; Opus 5 re-runs cyber on Opus 4.8 and refuses bio; Sonnet 5.5 re-runs cyber on Sonnet 5 and refuses bio. In a subagent, with fallback set to switch automatically, the flagged request re-runs on the fallback and the session's model is unchanged; with "ask each time" the subagent fails ("Agent terminated early due to an API error"). In the main session a fallback stays until /model (checked 2026-10-08); switchModelsOnFlag=false makes the main session ask. Opus 4.8 is documented as the fallback target, not as a classifier source. Ordinary coding content is not a documented trigger; code-heavy tiers sit on Opus 5.5 or Sonnet for cost, not to dodge a swap.
- trigger_model is stored once in config so the orchestrator tier is edited in one place. Opus 5.5 orchestrates well: it is capable, has no frontier allowance cap, and costs well under half the frontier tier's price. Whatever it is set to, keep security detail inside the security subagents so the orchestrator's own flag-prone message volume stays near zero: a flagged request in the main session moves the whole session to the fallback model until /model. If moved to claude-fable-5-2, orchestration quality improves, but the frontier tier draws down its allowance faster and is subject to plan caps. It is advice only: nothing enforces it, and the main session's model is set with /model.
- Fast mode (Opus, toggled with /fast) fits latency-sensitive quality gates (code review) and high-throughput reasoning passes.
- Destructive schema/migration changes: the backend developer (developer-backend) must escalate the design decision to a capable tier and follow backup-first, manual-SQL, data-loss-warning policy before execution, regardless of its Sonnet default.
- Pin by full ID only where the guarantee matters (the two offensive agents on claude-opus-4-8, the three reviewers on claude-opus-5-5); everywhere else the alias in frontmatter is intended, so the roster tracks the current model of each tier.
