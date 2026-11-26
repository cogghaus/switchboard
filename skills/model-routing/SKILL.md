---
name: model-routing
description: Pick the best token-to-quality model for a non-roster sub-agent (general-purpose, Explore, Plan), and look up the model each roster agent carries. Roster agents are spawned with no model argument. Consult before spawning a non-roster agent or changing a model.
---

# Model Routing

The decision aid for which model to use for a given task or agent, so you spend capable tiers where quality compounds and cheap tiers on volume.

## Consult

Read `model-matrix.md` in this skill's folder - hard rules on top, a per-tier and per-agent table below. That is usually all you need before spawning a non-roster agent; a roster agent's model is already in its definition. `model-matrix.json` alongside it is the machine-readable source.

## Hard rules (override the tables)

1. **Offensive security work (red team, pentest, exploit development) runs on Opus 4.8** (`claude-opus-4-8`), pinned by full ID: on the newer tiers nearly every such request would be flagged and run twice.
2. **Defensive security review runs on Opus 5.5** (`claude-opus-5-5`), pinned by full ID. A flagged request re-runs on Opus 4.8 by itself and the next ones return to Opus 5.5. Keep fallback on automatic switching (the default unless `switchModelsOnFlag` is false or set to ask each time): in "ask each time" a flagged subagent fails instead.
3. **Spawn every roster agent without a `model` argument.** A model passed on the Agent call replaces the definition's model, pins included; the definition decides. Pass a model only to a non-roster agent (general-purpose, Explore), picked from the matrix.
4. **Two model surfaces.** The Agent tool takes only the aliases `fable`, `opus`, `sonnet`, `haiku`; a definition's `model:` takes an alias or a full ID. Aliases move between model versions, so pin by full ID where the guarantee matters.

## Why aliases

Nine agents carry the alias in their frontmatter (`model: fable` or `sonnet`), so each follows the current model of its tier and a new generation needs no edit to those files; the matrix records what each alias resolves to today (on the Anthropic API; Bedrock and Foundry resolve aliases to older models). Five agents are pinned by full ID instead. The two offensive agents (`testing-red-team`, `testing-pentester`) stay on `claude-opus-4-8`: an alias can move to a classifier-carrying tier, where their work would be flagged on nearly every request. The three reviewers (`reviewer-code`, `reviewer-ux`, `reviewer-security`) are pinned to `claude-opus-5-5`.

The reviewers use the full ID rather than `model: opus` because of the same-family rule: an alias follows the parent session's model when the parent is the same family (Claude Code subagent docs, "Which version a model alias selects"), so under an Opus 4.8 main session `model: opus` would silently run the review gates on 4.8. The same exposure applies to any alias agent whose tier matches the main session: under a Fable main session the `fable` agents run on that session's Fable version, under a Sonnet main session the `sonnet` agents follow it. With the recommended Opus 5.5 main session neither happens, but changing `trigger_model` changes what the alias agents run on. `trigger_model` is advice only; the main session's model is set with `/model`.

## Short form

Capable tiers where quality compounds (design, ambiguity, orchestration, review); cheap tiers for volume (large mechanical work to a mid tier, quick lookups to a small tier); offensive security to the Opus 4.8 pin, defensive security review to the Opus 5.5 pin. Reserve the frontier tier for genuine ambiguity, design, and orchestration, where its strength pays for its higher cost.

## Modify

The orchestrator's own tier (`trigger_model`) is one row in the matrix config; change it in one place.

Edit `model-matrix.json` (add a tier, change a model, adjust the trigger), then update `model-matrix.md` to match. The matrix is the single source for each agent's `model:` frontmatter (the `frontmatter` field per agent); `model-matrix.md` is kept by hand.
