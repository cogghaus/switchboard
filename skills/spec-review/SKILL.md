---
name: spec-review
description: "Use before building any feature big enough to need a spec: when asked to write a spec or design doc, 'spec this', run a design session, or when the orchestrator-loop meets a substantial feature with unsettled design. The orchestrator writes the spec (with [V]/[I]/[Q] marks) and any ADR, a fresh Fable reviewer attacks it, the two converse until both approve, and only then is the approved spec presented to the user. Nothing is built before approval."
---

# Spec Review

Spec first, reviewed by a second mind, approved, then built. The orchestrator writes; a fresh Fable reviewer critiques; they iterate until both approve; the user sees the result. Building starts only after that.

## The process

1. **Write the spec** yourself, in the project's design docs (where its `docs/` or ADR convention says), on a branch, docs only. Mark every claim: `[V]` verified (checked against code, the real system or a doc), `[I]` inferred (say what would confirm it), `[Q]` open question. Add an ADR for any architecture choice. Test what you can test before writing it down; do not leave a testable fact as `[I]`.
2. **Spawn the reviewer:** Agent tool, `subagent_type: switchboard:architect` (or the active theme's name for that agent, see Theme below), `model: "fable"` (fresh context, read-only: Read, Grep, Glob). Use the brief below. Note the agent id.
3. **Answer every finding** (round protocol below), commit the revision, and send it back to the SAME reviewer with `SendMessage` so its context is kept.
4. **Stop when** the reviewer's latest reply carries the verdict line `VERDICT: APPROVED` and you have no open disagreement. At most three rounds in all; if the third reply is not an approval, the user decides (see Round protocol).
5. **Present to the user:** a short summary of the spec, the decisions made on each `[Q]`, the open risks, and the version bump it implies (patch / minor / major; major is the user's call). Then wait for the user's go.
6. **Build** on the user's go. If the user already said "build once approved", build at once through the usual flow: builder agent with the builder brief below, failing test first, code review against the spec, CI.

## Reviewer brief (fill the paths; paste the rest)

> Review the spec at `<spec path>` and the ADR at `<adr path>`, plus the code the spec relies on: `<paths>`. You are read-only; do not write or edit anything.
> Check: (1) correctness and safety gaps against the project's hard rules (`<CLAUDE.md path>`); (2) gaps against the stated goal: `<goal in one line>`; (3) whether a builder agent could build it in one pass from the text alone; (4) whether the ADR's choice is sound against its alternatives; (5) for every `[Q]`, give a decision or a proposal; challenge any `[V]` you can disprove from the code.
> Answer format: first line `VERDICT: APPROVED` or `VERDICT: CHANGES REQUESTED`. APPROVED only when nothing Blocking or Important is open. Then numbered findings, each with severity (Blocking / Important / Minor), spec section, evidence (file:line), and the change you want. No finding without evidence. Do not rewrite the spec; say what to change.

On later rounds the brief is the orchestrator's reply (below); the reviewer keeps its context and the same answer format.

## Round protocol

- Reply to each numbered finding: **accepted** (spec changed, say where), or **pushed back** with evidence. A fact you can test, you test first (on the real system or code) and quote the result.
- No finding is dropped silently. List all of them in the reply, even the ones accepted without comment.
- Commit each revision; the reply names the commit and what changed.
- Blocking and Important findings must be resolved; a Minor that is a few lines is fixed in the same pass, otherwise it becomes an issue and does not hold the approval.
- A disagreement still open after two rounds goes to the user as a decision, with both positions and the evidence. Do not win by repeating, and do not concede to end the loop.
- Overall cap: three rounds. If the reviewer has not approved after the third, stop and give the user the spec, the open findings and your replies; the user decides.
- If the same reviewer cannot be continued (the agent id is gone, `SendMessage` is unavailable, or the context is lost), spawn a new reviewer only with the full record: the spec, the ADR, and every earlier finding and reply, written to a file and passed by path (not paraphrased in the prompt). Say in the reply to the user that the reviewer changed and why. Otherwise never spawn a new reviewer to continue a review.

## Builder brief (after the user's go)

Spawn the builder (`developer-backend`, `developer-frontend`, or whoever fits) with the usual brief plus:

> The approved spec at `<spec path>` (and ADR `<adr path>`) is the contract. Build exactly what it says; do not improvise beyond it.
> Failing test first for every behaviour the spec describes, not only bug fixes: write the test, run it, see it fail for the right reason, then write the code. Quote the failing line in your report.
> If the spec is wrong, ambiguous or impossible against the real code, stop and return with what you found. Do not work around it and do not change the spec yourself.
> Acceptance criteria: `<criteria taken from the spec>`.

Then run `reviewer-code` with the spec path in its brief: it checks the build against the spec's acceptance criteria as well as against the diff, and a behaviour the spec requires that the build lacks is a finding.

## Extra reviewers

- **Security-heavy spec** (auth, secrets, input handling, uploads, integrations): also run `reviewer-security` on the spec and the code it relies on, with the assets to protect and the trust boundaries in the brief. It returns a severity-ordered list (CRITICAL / HIGH / MEDIUM / LOW) and a closing verdict, "clean" or "blocked pending" the listed fixes. It does not write a `VERDICT:` line; read it as: CRITICAL and HIGH are Blocking, MEDIUM is Important, LOW is Minor, "clean" is approval only when no MEDIUM is open (a MEDIUM stays Important and must be resolved), "blocked" is not. Quote its closing verdict. If the brief names no assets or threat model it states the assets it assumed and reviews against those, so the spec should confirm or correct them. Fable and Opus 5.5 run safety classifiers and a flagged request silently re-runs on a fallback model inside a subagent; keep security detail inside `reviewer-security` (pinned to Opus 4.8).
- **UI-heavy spec** (screens, flows, forms, grids): also run `reviewer-ux` on the spec. It returns `APPROVED`, `CHANGES REQUESTED` or `BLOCKED` and Critical / Important / Minor findings, each citing a standard. Critical and Important are Blocking-equivalent and must be resolved; BLOCKED means the approach must be replaced, not patched. It cannot see rendered output, so contrast and layout items under its "Needs a rendered check" list are carried into the spec as checks for a human or a tool.
- Treat these verdicts like the architect's: quote the closing verdict of the latest round, and their findings go through the same round protocol.

## Model and tier

Reviewer: Fable (`model: "fable"`, via the architect agent, whose frontmatter carries the same `fable` alias, so the agent and the spawn agree). Writer: you, the orchestrator, on whatever tier the session runs on (the matrix suggests Opus 4.8 as `trigger_model`); spec writing is not delegated. That is deliberate: the fresh Fable reviewer is the second mind, and the review, not the writer's tier, supplies the frontier-tier scrutiny. If the reviewer's reply looks truncated or off-model, say so and re-ask.

## Theme

`theme` renames agents, so the `subagent_type` above follows the active theme's name for the architect (`switchboard:<themed-name>`); the role is what matters, not the slug. If `theme.json` exists at the plugin root, read the architect's themed name from it.

## Must not

- Build, scaffold or write code before the user's go (or a prior "build once approved").
- Report the reviewer as approving without quoting its `VERDICT:` line (or, for the security and UX reviewers, their closing verdict) from the latest round. A summary of its mood is not a verdict.
- Let the reviewer write or edit the spec, or let it see only your summary instead of the files.
- Argue from the reviewer's findings without checking them: it can be wrong, and a finding with no file:line evidence is a question, not a defect.
- Skip the ADR when the spec makes an architecture choice, or leave a `[Q]` unanswered in the approved spec.
- Run past three rounds without the user.
- Treat a trivial change as needing this. A one-file fix or a small tweak goes straight to the orchestrator-loop; use this for work a builder could get wrong because the design is unsettled.
