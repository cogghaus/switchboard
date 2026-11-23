---
name: model-routing
description: Pick the best token-to-quality model when delegating a task to a specialist sub-agent. Consult before spawning any agent.
---

# Model Routing

The decision aid for which model to use for a given task or agent, so you spend capable tiers where quality compounds and cheap tiers on volume.

## Consult

Read `model-matrix.md` in this skill's folder - hard rules on top, a per-tier and per-agent table below. That is usually all you need before spawning. `model-matrix.json` alongside it is the machine-readable source.

## Hard rules (override the tables)

1. **Security, dual-use, red-team, pentest, and vulnerability work run on Opus 4.8** (`claude-opus-4-8`), pinned by explicit full model ID in the agent's definition.
2. **Two model surfaces.** A sub-agent definition's `model:` frontmatter accepts an alias or a full model ID; the live Agent tool takes model aliases. Aliases can move between model versions, so pin security-critical agents by full ID in their definitions and re-verify alias behavior periodically.
3. **Trigger model.** The orchestrator's own tier is one row in the matrix config; change it in one place.

## Why aliases

Nine agents carry the alias in their frontmatter (`model: fable` or `sonnet`), so each follows the current model of its tier and a new generation needs no edit to those files; the matrix records what each alias resolves to today (on the Anthropic API; Bedrock and Foundry resolve aliases to older models). The three security agents (`reviewer-security`, `testing-red-team`, `testing-pentester`) stay on the explicit full ID `claude-opus-4-8`: an alias can move to a classifier-carrying tier, and a security pin must not.

`reviewer-code` and `reviewer-ux` are pinned by full ID `claude-opus-5-5`, an exception to the alias rule, because of the same-family rule: an alias follows the parent session's model when the parent is the same family (Claude Code subagent docs, "Which version a model alias selects"). The recommended orchestrator is Opus 4.8, so `model: opus` would silently run both review gates on 4.8. The same exposure applies to any alias agent whose tier matches the main session: under a Fable main session the `fable` agents run on that session's Fable version, under a Sonnet main session the `sonnet` agents follow it. With the recommended Opus 4.8 main session neither happens, but changing `trigger_model` changes what the alias agents run on. `trigger_model` is advice only; the main session's model is set with `/model`.

## Short form

Capable tiers where quality compounds (design, ambiguity, orchestration, review); cheap tiers for volume (large mechanical work to a mid tier, quick lookups to a small tier); security and dual-use to the stable security tier. Reserve the frontier tier for genuine ambiguity, design, and orchestration, where its strength pays for its higher cost.

## Modify

Edit `model-matrix.json` (add a tier, change a model, adjust the trigger), then update `model-matrix.md` to match. The matrix is the single source for each agent's `model:` frontmatter (the `frontmatter` field per agent); `model-matrix.md` is kept by hand.
