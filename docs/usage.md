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

## Direct vs delegate

- **Do it yourself:** small edits, quick lookups, the framing and decomposition, the review, and every serial write and commit.
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

## Making it automatic

The `orchestrator-loop` skill auto-invokes on substantial tasks, but auto-invocation is best-effort. To enter the loop deliberately, call it by name with `/orchestrator-loop`. To make it your standing default on every session, add the opt-in `SessionStart` hook documented in `skills/orchestrator-loop/SKILL.md`.

## See also

- [agents.md](agents.md) - the specialist roster.
- [skills.md](skills.md) - the skills that drive the roster.
- [install.md](install.md) - install, theming, and wiring into a project.
