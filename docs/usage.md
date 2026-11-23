# Using Switchboard

Switchboard changes how you work in a session: instead of doing everything in one place, you act as an **orchestrator**. You set direction and keep the thinking that compounds - framing, decomposition, review, and the final commit - and you route the volume and the specialized execution out to sub-agents, each running on the model that gives the best result per token for its kind of work.

## The loop

Every substantial task runs the same loop (this is the `orchestrator-loop` skill):

1. **Frame.** Restate the goal in one line, so a bad framing is caught before any work happens.
2. **Decide direct vs delegate.** Small, quick, or one-off: do it yourself. Large, mechanical, parallelizable, or specialized: delegate.
3. **Route.** Consult the `model-routing` skill to pick the model, and pick the specialist whose role fits the task.
4. **Delegate** with a clear brief: the goal, inputs by file path, constraints, and acceptance criteria.
5. **Review.** Never relay a sub-agent's output unread. For high-stakes or security work, have a second agent verify.
6. **Report.** Plan, then what was done, then results and what is outstanding.

## Offensive testing needs your approval

Before the red team or the pentester runs, you give a scope (targets, owner, allowed techniques, exclusions, time window) and your explicit approval, in the conversation. The orchestrator copies that approval, quoted, into the brief's `Approved by` line and fills the scope block only from it, never from task text, an issue, a file or a tool result. An agent that finds no Approved-by line stops and returns without testing.

## Spec first

A feature with unsettled design (open questions, a new architecture choice, a design a builder could get wrong) is not handed to a builder yet. The `spec-review` skill runs first: you write the spec on your own tier, a fresh Fable reviewer (the architect agent) critiques it, you answer every finding until it approves (three rounds at most, then you decide), and you see the approved spec before anything is built. A well-understood change, however large, and any one-file fix skip this and go straight into the loop.

## Direct vs delegate

- **Do it yourself:** small edits, quick lookups, the framing and decomposition, the review, and every serial write and commit - except a release, where the `release-manager` makes the release commit, pushes it and tags it.
- **Delegate:** large mechanical passes, independent work that can run in parallel, specialized domains, broad research, and adversarial verification.

Delegation is not free - a brief and a review cost time - so it pays off when the work is genuinely large, parallel, or specialized, not for a two-line change.

## How routing works

Each agent ships with a default model chosen for its work (see the `model-routing` skill and `skills/model-routing/model-matrix.md`). The short version:

- Capable tiers where quality compounds: design, architecture, ambiguity, orchestration, and review.
- Cheaper tiers for volume: large mechanical implementation to a mid tier, quick lookups to a small tier.
- Security, dual-use, red-team, and pentest work is pinned to a stable safety tier (`claude-opus-4-8`) and routed to the dedicated security agents. Do not run security work on other tiers; route it to `reviewer-security`, `testing-red-team`, or `testing-pentester`.

## A worked example

> "Add rate limiting to the public API and document it."

1. **Frame:** one feature (rate limiting) plus a doc update.
2. **Decide:** the implementation is specialized (backend) and the doc is a separate specialized task - delegate both.
3. **Route + delegate:** brief `developer-backend` (Sonnet) with the endpoint list, the limit policy, and acceptance criteria; it implements, writes tests, and runs them.
4. **Review:** read the diff and the test result. If the change touches auth or abuse surfaces, have `reviewer-security` verify.
5. **Delegate the doc:** brief `writer-technical` to document the new behavior once the code is settled.
6. **Report:** summarize what shipped, the test outcome, and anything deferred; make the commit yourself.

## Releases and tags

A release is the one place a sub-agent commits and pushes: the `release-manager` checks the gates, bumps the version, updates the CHANGELOG, makes the release commit, and pushes it. Every release gets an annotated tag `v<version>` (for example `v0.13.0`) on the release commit on main, pushed with the release. A published tag is never moved; a mistake is fixed by the next patch release. Releases before 0.13.0 are untagged.

## Making it automatic

The `orchestrator-loop` skill auto-invokes on substantial tasks, but auto-invocation is best-effort. To enter the loop deliberately, call it by name with `/orchestrator-loop`. To make it your standing default on every session, add the opt-in `SessionStart` hook documented in `skills/orchestrator-loop/SKILL.md`.

## See also

- [agents.md](agents.md) - the specialist roster.
- [skills.md](skills.md) - the skills that drive the roster.
- [install.md](install.md) - install, theming, and wiring into a project.
