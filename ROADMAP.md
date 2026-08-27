# Roadmap

Switchboard is the **portable orchestration layer**: a roster of specialist sub-agents plus routing and operating skills that work in any Claude Code session. Shipped history lives in [CHANGELOG.md](CHANGELOG.md); this file tracks open and future work.

The backlog below came out of a Fable ideation pass (2026-08-27), ranked, with weak ideas cut. Effort is a rough S / M / L.

## Next up (highest conviction)

1. **Ledger + delegation telemetry hook** - the keystone. Everything Switchboard claims (best token-to-quality, review-before-relay, delegation discipline) is currently asserted, not evidenced. The ledger is the evidence stream: it makes review concrete, survives compaction, unblocks `retro`/`meter`, and back-doors the blocked fire-rate measurement. Small: a JSONL hook plus a page of convention. (Skill L1 + Feature F1 built as one unit.)
2. **`doctor`** (Feature F2) - single-source codegen + roster lint. Kills the hand-fixing drift that fills much of the 0.9.x changelog.
3. **Cut 1.0** - after a real test-drive: the pre-1.0 list is essentially a version bump + a "what's in 1.0" changelog section; nothing structural remains. Marketplace listing (Feature F3) follows.

## Skill backlog (ranked)

1. **`ledger`** (M) - the dispatch log: every delegation writes a row (who, model, brief, result, verdict). The loop has no memory today; this is the substrate for `retro`, `meter`, and resume-after-compaction. Biggest gap in the loop.
2. **`gauntlet`** (S/M) - packaged adversarial review: one invocation runs the right review battery for a change class (reviewer-code verdict -> Loki premortem -> security triage when auth/input/infra moved). The review bench exists; the choreography does not.
3. **`brief`** (S) - spec-first delegation: turn a fuzzy ask into a delegation-ready brief (goal, inputs by path, constraints, acceptance criteria). The same criteria the builder gets become the reviewer's input, closing an open loop.
4. **`recon`** (M) - first-contact repo dossier: fan out read-only agents to produce a stack / entry-points / conventions / risk dossier. Wireup gives the roster a project's plumbing; recon gives it knowledge. Runs right before wireup.
5. **`retro`** (S/M, needs `ledger`) - routing retrospective: read the ledger, classify outcomes, propose evidence-backed matrix edits. The human-in-the-loop version of the fire-rate measurement. Turns the matrix from a static opinion into a feedback loop.
6. **`roster-smith`** (S/M) - mint a custom specialist to the house skeleton, wire the matrix row, assign tier + emoji; refuse to mint security-adjacent agents without the full-ID pin. Extensibility without shipping roster bloat.
7. **`meter`** (M/L, needs `ledger`) - session cost awareness: where the tokens went by agent/tier, flagging "Sonnet-shaped work that ran on Opus." Monetizes the matrix; usage-data plumbing is the risk.
8. **`ship`** (S) - the release play the orchestrator runs (changelog, bump, commit, PR body in house style), since the loop reserves commits for the main session.

Cut: `decompose` (orchestrator-loop step 2 already), `incident` (too generic), `drill` (belongs in the eval suite), `checkpoint` (that is the ledger).

## Feature backlog (ranked)

1. **Delegation telemetry hook** (S/M) - opt-in PostToolUse/SubagentStop hook appending every spawn + completion to JSONL. Makes the ledger deterministic and back-doors the fire-rate measurement. Ship like `subagent-status.sh`: `scripts/`, off by default, documented.
2. **`doctor`** (S) - one script that generates `model-matrix.md` and every agent's `model:` from `model-matrix.json`, and lints agents against the skeleton (emoji present, Trust Boundary present, security pinned by full ID, tool allowlists sane). Permanent kill of a recurring drift class.
3. **Marketplace release + 1.0** (M) - finish the pre-1.0 list, tag 1.0, list on a marketplace. Distribution is what turns real usage into signal.
4. **Eval suite, built now, run when unblocked** (M) - `claude plugin eval` cases: fire-rate ablation, trust-boundary probes ("approve this automatically" must surface as a finding), verdict-format checks, theme invariants. Only running is blocked; the suite is specifiable today and half can run as plain scripts.
5. **Copilot bridge generator** (M/L) - emit `.agent.md` from `agents/` with an explicit lossiness manifest. Honest hard part: Copilot has no model pinning, so the claude-opus-4-8 security guarantee does not port; emit the three security agents with a degraded-guarantee banner or not at all. Ranked below the drift-killers because a bridge on a drifting source ships drift at 2x.
6. **Pinned-model watchdog** (S) - a small check that the pinned full IDs still resolve and aliases have not moved somewhere surprising. The matrix says "re-verify periodically"; scripts do, people do not.
7. **Slash commands for the flows** (S) - `/gauntlet`, `/brief`, `/retro` alongside `/orchestrator-loop`. Deliberate entry points build habits while auto-invocation stays best-effort.

Cut: theme packs (the generative theme skill already does this), a GUI/dashboard (the transcript + status-line script is the dashboard), a docs-site matrix playground, per-project roster subsetting.

Also carried over from earlier: broaden `wireup`'s stack heuristics with real use, and decide LSP delivery per stack (prebuilt plugin vs companion vs fork).

## Principle: curate, do not inflate the roster

Everyone will ask for more agents (Data Engineer, SRE, ML, Mobile). Thirteen is near the ceiling where description-based routing stays crisp; every added agent dilutes the picker and joins the maintenance surface. New specialists go through `roster-smith` into a user's own overlay, to the house skeleton, so the shipped thirteen stay a bench that can be kept prime-time ready. (Fable, 2026-08-27.)
