# Orchestrator's Assistant

A Claude Code plugin that gives the main session (the orchestrator) a roster of
specialist sub-agents to delegate to, plus routing and operating skills for
running them well.

## What is bundled

- **`agents/`** - twelve specialist sub-agent definitions, one per role
  (security review, frontend, backend, QA, architecture, product/requirements,
  documentation, release management, code review, offensive security x2,
  lateral-thinking/brainstorm). Each is a standalone Claude Code sub-agent:
  name, routing description, an explicit tool allowlist, and an assigned
  model. They carry the full persona - identity, communication style,
  principles, domain expertise, output/severity/verdict formats, and voice -
  of the original forge-lab agent personalities they were converted from, with
  all forge-lab runtime plumbing (hub API calls, done-file contracts, session
  memory protocol, daemon/dispatcher mechanics) stripped out. In this plugin,
  a sub-agent is spawned by the orchestrating main session and returns its
  result directly - there is no separate daemon or hub to report to.

- **Skills** (routing and model-matrix wiring) are not yet included in this
  first cut. That is a deliberate follow-up step, not an oversight.

## Origin

The agent personalities originate from `forge-lab`'s
`packages/forge-agents/personalities/`, a multi-agent orchestration system
with its own daemon/hub runtime. This plugin extracts the personas only and
re-targets them at Claude Code's native sub-agent mechanism.

One personality - the Orchestrator (`forge-master`) - was deliberately not
converted to a sub-agent. In a Claude Code plugin, the orchestrator role is
the human's own main session, not a spawned sub-agent, so the fit is
different. See the project's session notes for the reviewer decision on
whether to exclude it entirely or repurpose it as a triage/decomposition
helper sub-agent.
