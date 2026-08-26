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
2. **Two model surfaces.** A sub-agent definition's `model:` frontmatter accepts a full model ID; the live Agent tool takes model aliases. Aliases can move between model versions, so pin security-critical agents by full ID in their definitions and re-verify alias behavior periodically.
3. **Trigger model.** The orchestrator's own tier is one row in the matrix config; change it in one place.

## Short form

Capable tiers where quality compounds (design, ambiguity, orchestration, review); cheap tiers for volume (large mechanical work to a mid tier, quick lookups to a small tier); security and dual-use to the stable security tier. Reserve the frontier tier for genuine ambiguity, design, and orchestration, where its strength pays for its higher cost.

## Modify

Edit `model-matrix.json` (add a tier, change a model, adjust the trigger), then update `model-matrix.md` to match. The matrix is the single source for each agent's `model:` frontmatter.
