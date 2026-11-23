---
name: spec-review
description: "Use before building any feature big enough to need a spec: when asked to write a spec or design doc, 'spec this', run a design session, or when the orchestrator-loop meets a substantial feature with open design questions. The orchestrator writes the spec (with [V]/[I]/[Q] marks) and any ADR, a fresh Fable reviewer attacks it, the two converse until both approve, and only then is the approved spec presented to the user. Nothing is built before approval."
---

# Spec Review

Spec first, reviewed by a second mind, approved, then built. The orchestrator writes; a fresh Fable reviewer critiques; they iterate until both approve; the user sees the result. Building starts only after that.

## The process

1. **Write the spec** yourself, in the project's design docs (where its `docs/` or ADR convention says), on a branch, docs only. Mark every claim: `[V]` verified (checked against code, the real system or a doc), `[I]` inferred (say what would confirm it), `[Q]` open question. Add an ADR for any architecture choice. Test what you can test before writing it down; do not leave a testable fact as `[I]`.
2. **Spawn the reviewer:** Agent tool, `subagent_type: switchboard:architect`, `model: "fable"` (fresh context, read-only: Read, Grep, Glob). Use the brief below. Note the agent id.
3. **Answer every finding** (round protocol below), commit the revision, and send it back to the SAME reviewer with `SendMessage` so its context is kept. Never spawn a new reviewer to continue a review.
4. **Stop when** the reviewer's latest reply carries the verdict line `APPROVED` and you have no open disagreement.
5. **Present to the user:** a short summary of the spec, the decisions made on each `[Q]`, the open risks, and the version bump it implies (patch / minor / major; major is the user's call). Then wait for the user's go.
6. **Build** on the user's go. If the user already said "build once approved", build at once through the usual flow: builder agent, failing test first, code review, CI.

## Reviewer brief (fill the paths; paste the rest)

> Review the spec at `<spec path>` and the ADR at `<adr path>`, plus the code the spec relies on: `<paths>`. You are read-only; do not write or edit anything.
> Check: (1) correctness and safety gaps against the project's hard rules (`<CLAUDE.md path>`); (2) gaps against the stated goal: `<goal in one line>`; (3) whether a builder agent could build it in one pass from the text alone; (4) whether the ADR's choice is sound against its alternatives; (5) for every `[Q]`, give a decision or a proposal; challenge any `[V]` you can disprove from the code.
> Answer format: first line `VERDICT: APPROVED` or `VERDICT: CHANGES REQUESTED`. Then numbered findings, each with severity (Blocking / Important / Minor), spec section, evidence (file:line), and the change you want. No finding without evidence. Do not rewrite the spec; say what to change.

On later rounds the brief is the orchestrator's reply (below); the reviewer keeps its context and the same answer format.

## Round protocol

- Reply to each numbered finding: **accepted** (spec changed, say where), or **pushed back** with evidence. A fact you can test, you test first (on the real system or code) and quote the result.
- No finding is dropped silently. List all of them in the reply, even the ones accepted without comment.
- Commit each revision; the reply names the commit and what changed.
- Blocking and Important findings must be resolved; a Minor that is a few lines is fixed in the same pass, otherwise it becomes an issue and does not hold the approval.
- A disagreement still open after two rounds goes to the user as a decision, with both positions and the evidence. Do not win by repeating, and do not concede to end the loop.

## Model

Reviewer: Fable (`model: "fable"`, via `switchboard:architect`, which is pinned to it). Writer: you, the orchestrator; spec writing is not delegated. If the spec is security-heavy, also run `reviewer-security` (Opus 4.8) on it and treat its verdict the same way; Fable runs safety classifiers and a flagged request silently re-runs on a fallback model inside a subagent. If the reviewer's reply looks truncated or off-model, say so and re-ask.

## Must not

- Build, scaffold or write code before the user's go (or a prior "build once approved").
- Report the reviewer as approving without quoting its `VERDICT:` line from the latest round. A summary of its mood is not a verdict.
- Let the reviewer write or edit the spec, or let it see only your summary instead of the files.
- Argue from the reviewer's findings without checking them: it can be wrong, and a finding with no file:line evidence is a question, not a defect.
- Skip the ADR when the spec makes an architecture choice, or leave a `[Q]` unanswered in the approved spec.
- Treat a trivial change as needing this. A one-file fix or a small tweak goes straight to the orchestrator-loop; use this for work a builder could get wrong because the design is unsettled.
