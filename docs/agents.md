# Agent Reference

Switchboard's roster is 13 specialist sub-agents living in `agents/`. Each one is a standalone Claude Code sub-agent that the orchestrator spawns for a specific kind of work - it is not a persona switch inside one conversation, but a separate agent with its own context, its own tool allowlist, and its own default model drawn from the model-routing matrix (`skills/model-routing/model-matrix.md`). Each agent carries an emoji so you can tell at a glance which specialist is working. The orchestrator routes a task to the agent whose domain fits, the agent works within its allowlisted tools, and it returns its result directly rather than persisting state on its own.

## Reference table

|  | Agent | slug | Default model | Use when |
|---|---|---|---|---|
| 🔥 | Backend Developer | `developer-backend` | claude-sonnet-5 | Building or modifying backend code - routes, middleware, services, data models, schema/migrations, backend tests |
| 🔨 | Frontend Developer | `developer-frontend` | claude-sonnet-5 | Building or modifying frontend UI - components, pages, styling, UI state/hooks, interaction tests |
| 🎨 | Designer | `designer` | claude-fable-5 | Product/UX design - journeys, wireframes, interaction and visual design, accessibility - ahead of or alongside frontend work |
| ⚖️ | Code Reviewer | `reviewer-code` | claude-opus-5 | Code review with an explicit verdict, AC verification, and a Critical/Important/Minor findings list |
| 🛡️ | Security Reviewer | `reviewer-security` | claude-opus-4-8 | Defensive security review of auth, input handling, secrets, uploads, integrations, or dependencies |
| 🧪 | QA Engineer | `testing-qa` | claude-sonnet-5 | Test design and execution, bug hunting/reproduction, edge-case coverage, Definition-of-Done enforcement |
| ⚡ | Infra Pentester | `testing-pentester` | claude-opus-4-8 | Authorized infra-focused security testing - CVEs, CI/CD, secret exposure, containers, supply chain |
| 💀 | Red Team Lead | `testing-red-team` | claude-opus-4-8 | Authorized application-layer offensive testing - OWASP Top 10, auth attacks, business logic abuse, prompt injection |
| 🏛️ | Architect | `architect` | claude-fable-5 | System architecture decisions, tech/vendor evaluation, cross-cutting design, ADRs |
| 🔮 | Business Analyst | `business-analyst` | claude-sonnet-5 | Requirements before implementation - problem framing, story breakdown, acceptance criteria, scope discipline |
| 📜 | Technical Writer | `writer-technical` | claude-sonnet-5 | Maintaining the project knowledge base - architecture docs, ADRs, API references, runbooks, staleness audits |
| 📯 | Release Manager | `release-manager` | claude-sonnet-5 | Coordinating a release - semver bumps, CHANGELOG, tagging, pre-release gates, deploy coordination |
| 🎭 | Loki | `loki` | claude-fable-5 | Invitation-only: challenging assumptions and surfacing alternatives in brainstorms, design reviews, premortems, post-mortems |

## Build & design

**🔥 Backend Developer** (`developer-backend`) owns the server side: API route handlers, middleware, the service/business-logic layer, data models, database schema and migrations, and backend tests. It works schema-first, validates everything crossing a trust boundary, and treats migrations as largely one-way - a destructive schema change on a table with data gets flagged for an explicit backup confirmation rather than run silently. Route backend implementation work here; see `agents/developer-backend.md` for the full definition.

**🔨 Frontend Developer** (`developer-frontend`) owns components, pages, styling, UI state/hooks, and component-level tests. It builds accessibility-first (targeting WCAG 2.1 AA) and performance-aware, following the existing design system rather than inventing new patterns. Route UI implementation work here; see `agents/developer-frontend.md`.

**🎨 Designer** (`designer`) produces the design spec the Frontend Developer builds from: user flows, annotated wireframes, states (empty/loading/error/success), design-system tokens and components, and accessibility requirements. It works before or alongside frontend implementation, not after. Route UX/visual design work here; see `agents/designer.md`.

## Review & testing

**⚖️ Code Reviewer** (`reviewer-code`) is the quality gate: it verifies acceptance criteria, lists findings by Critical/Important/Minor with file:line evidence, and issues exactly one verdict (APPROVED / CHANGES REQUESTED / BLOCKED). It reviews only - it never implements a fix itself. Route completed work here before merge; see `agents/reviewer-code.md`.

**🛡️ Security Reviewer** (`reviewer-security`) audits authentication/authorization, input handling and queries, file uploads, external integrations, secrets handling, and dependency usage, returning a severity-classified (CRITICAL/HIGH/MEDIUM/LOW) findings report with concrete remediations. It is defensive and advisory (read-only), and it routes active scanning to the Infra Pentester. Route any change touching those areas here; see `agents/reviewer-security.md`.

**🧪 QA Engineer** (`testing-qa`) designs and runs unit, integration, and end-to-end tests, hunts and reproduces bugs, and enforces Definition-of-Done before a task is called ready for review. It owns all test files, fixtures, and coverage configuration. Route test design/execution and bug investigation here; see `agents/testing-qa.md`.

**⚡ Infra Pentester** (`testing-pentester`) runs authorized infrastructure-focused security testing: dependency and CVE scanning, CI/CD pipeline security, secret-exposure detection, container security, supply-chain analysis, and resilience probes, strictly within a pre-authorized engagement scope. Route infra-layer offensive testing here; see `agents/testing-pentester.md`.

**💀 Red Team Lead** (`testing-red-team`) runs authorized application-layer offensive testing - OWASP Top 10, auth/authz attacks, business logic abuse, and prompt-injection testing - producing an evidence-based engagement report with attack chains, proof of concept, and a remediation roadmap. Route application-layer offensive testing here; see `agents/testing-red-team.md`.

## Plan & docs

**🏛️ Architect** (`architect`) is the advisory owner of technical design: system architecture decisions, technology/vendor evaluation, cross-cutting concern design (auth, logging, caching, resilience), technical debt assessment, and ADRs weighed against maintainability, scalability, cost, and team capability. It analyzes and recommends; implementation is routed elsewhere. Route significant design decisions here; see `agents/architect.md`.

**🔮 Business Analyst** (`business-analyst`) defines requirements before implementation begins: problem framing, epic/story breakdown with testable acceptance criteria, user research synthesis, prioritization, and scope discipline against feature creep. Route "what should we build, for whom, and why" here before work starts; see `agents/business-analyst.md`.

**📜 Technical Writer** (`writer-technical`) curates the living knowledge base: creating or updating architecture docs, ADRs, API references, and runbooks after a significant change, and auditing existing docs for staleness, contradiction, and redundancy. It writes for current state, not history. Route doc maintenance here after a significant change or for a doc audit; see `agents/writer-technical.md`.

**📯 Release Manager** (`release-manager`) coordinates a release end to end: semver version bumps, CHANGELOG maintenance, git tagging, pre-release gate checks, and deploy coordination, following a checklist that never bypasses a failed gate. It does not write feature code. Route release coordination here; see `agents/release-manager.md`.

## Challenger

**🎭 Loki** (`loki`) is invitation-only: it challenges assumptions and surfaces lateral alternatives during planning brainstorms, design reviews, premortems, and post-mortems. It offers two or three short provocations (challenge, alternative, inversion) and then yields the floor - no implementation plans, no day-to-day task work. Route it in deliberately when a decision needs stress-testing before it locks in; see `agents/loki.md`.

## Model assignments

The three security agents - 🛡️ Security Reviewer, 💀 Red Team Lead, and ⚡ Infra Pentester - are pinned to `claude-opus-4-8` by full model ID, not by alias, so security and dual-use work always lands on that tier regardless of how aliases move between model versions elsewhere. All model assignments in this document, including these three, come from `skills/model-routing/model-matrix.md` (the human-readable derived view of `skills/model-routing/model-matrix.json`, the source of truth) - consult it directly for the current routing rules and rationale rather than treating this reference as authoritative for future changes.
