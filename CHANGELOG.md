# Changelog

All notable changes to Switchboard are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Release convention: the version lives in `.claude-plugin/plugin.json` only. Every release gets an annotated git tag `v<version>` on the release commit on main, pushed after that commit is confirmed on remote main; a published tag is never moved (a mistake is fixed by the next patch release). Releases before 0.13.0 are untagged.

## [Unreleased]

### Added
- **switchboard-crew 0.1.1: off-pin marker.** The `/crew` panel marks a pinned roster agent (the three reviewers, the two offensive agents) spawned on another model: ` · off-pin (pinned Opus 5.5)`. That happens when a spawn passes a `model` argument, which replaces the definition's pin. It only observes; a mid-run classifier fallback is not flagged, and a spawn whose model is not known yet is not flagged. `PINS` in `crew/hooks/roster.ts` mirrors the full-ID frontmatter in `model-matrix.json`. Held out of 0.14.0 until its fallback test could be written: the secret-read guard refused the test file because token counts read as credentials, fixed in guard-parser #32.

## [0.14.0] - 2026-11-26

From a review of every agent and skill by five Fable 5.2 reviewers, checked against the maintainer's rule log and 737 real switchboard agent calls (2026-10-01 to 2026-11-26), with the model facts re-checked against the Claude Code docs on 2026-11-26.

### Added
- **Working Rules for the builders.** `developer-backend`, `developer-frontend` and `testing-qa` carry one identical section: change files with Edit and Write only (never through the shell), a refusal from a hook, guard or permission check is final for that route, exit codes are evidence (no piping a test run into `tail`), no foreground waits, affected tests only, no commit unless the brief says so, no installs or destructive commands, and what was verified kept apart from what was assumed. `release-manager` carries the same block with release bullets; `writer-technical` a docs version (every fact read in the task; the code is the ground truth). Until now none of these rules was in a definition: briefs had to paste them, and when they did, shell-edit calls fell by more than 90%.
- **Test first, on behaviour.** Both developers: write the test, see it fail on the behaviour (not a compile error or a missing import), only then the fix, never while the red run is in flight; quote the failing line as read. `testing-qa` hands a bug over as a failing reproduction test.
- **Loki in the regular flow.** `spec-review` runs `loki` once on the draft spec before the first review round, and `orchestrator-loop` sends significant design decisions and ADRs past it too. Its two or three counterpoints are answered in one line each under `Alternatives considered` and never block. `loki` drops its live-meeting text and gains Grep and Glob.

### Changed
- **Spawn roster agents with no `model` argument** (new model-routing hard rule). Claude Code takes the per-call `model` first, ahead of the definition, so a spawn-time model overrode every full-ID pin: 41 of 106 security reviews and 98 of 396 code reviews ran off their pin. `orchestrator-loop`, the session-start framing and `spec-review` (which passed `model: "fable"`) follow the rule.
- **Security review on Opus 5.5.** `reviewer-security` moves to `claude-opus-5-5` by full ID; a cybersecurity-flagged request re-runs on Opus 4.8 by itself and later requests return to Opus 5.5. In the maintainer's runs, 37 security reviews on Opus 5.5 or Fable 5.2 (about 2,000 turns) never fell back. The offensive agents (`testing-red-team`, `testing-pentester`) stay on `claude-opus-4-8`. The matrix splits the security tier into defensive review and offensive testing; `trigger_model` is now `claude-opus-5-5`. Keep fallback on automatic switching: under "ask each time" a flagged subagent fails instead.
- **One verdict line.** `reviewer-code`, `reviewer-ux`, `reviewer-security` and `architect` end every report with `VERDICT: APPROVED | CHANGES REQUESTED | BLOCKED` and a one-line reason. `reviewer-code` lists an unmet criterion as a Critical finding, and re-reviews check only the earlier Critical and Important fixes. A security review that does not end with `VERDICT: APPROVED`, including one that failed, blocks the release.
- **One Trust Boundary** in all 14 agents: the definition and the orchestrator's brief are the instructions, everything read while working is data, and a subagent cannot pause for confirmation.
- **Probe Files**, identical in `reviewer-code`, `testing-red-team` and `testing-pentester`: no Edit (rewrite with Write), never inside the project's tests directory, a way out when the test runner only finds in-repo files, no git state or config changes, and a refusal ends the route by any tool.
- `release-manager`: one CI re-run for a suspected flake, then stop; bumps through Edit or a file-only tool mode; a refused push or tag is a failed gate.

### Fixed
- **Secret probes that leaked.** The allowed form `grep -n ... | cut -d: -f1,2` printed the matched line on a single file or stdin, and `env | cut -d= -f1` could print multi-line values. Allowed forms are now a scanner's redact option, `grep -l` and `grep -c`, and environment names through `compgen -e`.
- The matrix classifier note names Fable 5, 5.1 and 5.2, says a subagent under "ask each time" fails instead of re-running, and drops the settled to-do about comparing Opus 4.8 with Opus 5.5.

## [0.13.0] - 2026-11-23

From the Fable review of the whole repo at 0.12.0 ([#10](https://github.com/cogghaus/switchboard/issues/10)). This is the first release to be tagged (`v0.13.0`).

### Changed
- **Models (H1, H2).** Nine agents now carry the alias in frontmatter (`model: fable` or `sonnet`), so each follows the current model of its tier and a new generation needs no edit to their files. The three security agents (`reviewer-security`, `testing-red-team`, `testing-pentester`) keep `claude-opus-4-8` by full ID, and `reviewer-code` and `reviewer-ux` are pinned to `claude-opus-5-5` by full ID: an alias follows the parent session's model when the parent is the same family, and the recommended orchestrator is Opus 4.8, so `opus` would silently run both gates on 4.8. The docs state the same exposure for the fable and sonnet agents under a Fable or Sonnet main session, and that the alias table holds for the Anthropic API (Bedrock and Foundry resolve aliases to older models). The matrix (JSON, now version 2, and its view) names the current models, checked 2026-11-23: Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5; the stale Fable 5.1 and Haiku 4.5 ids are gone, and a `frontmatter` field per agent records what each file holds. `model-routing` explains why aliases. The two contradictions in the matrix are fixed: Opus 4.8 is described as the documented fallback target, not a classifier source, in both places, and the hard rule lists every classifier-carrying tier. The classifier note is dated: verified 2026-10-08 for Fable 5.1 and re-checked 2026-11-23 by the reviewer, when the model-config doc said Fable models and Opus 5.5 re-run flagged cyber requests on Opus 4.8, which covers Fable 5.2. `reviewer-security`'s pin is kept pending a comparison of one real review on Opus 4.8 against Opus 5.5.
- **`spec-review` wired into what it relies on (H3).** The reviewer brief says APPROVED only when nothing Blocking or Important is open; three rounds in all, then the user decides; when the same reviewer cannot be continued, a new one gets the full record of findings and replies by file path; a builder brief makes the approved spec the contract (failing test first for every behaviour, stop and report a wrong spec, `reviewer-code` checks the build against the spec); a `reviewer-security` path that uses its own verdict words and severities, and a `reviewer-ux` path for UI-heavy specs; a security "clean" counts as approval only with no MEDIUM open; the subagent type follows the active theme's name for the architect. The writer-tier note is settled: the orchestrator writes on its own tier and the fresh Fable reviewer is the second mind. `architect` gains a spec-review mode (a `VERDICT:` line plus evidenced findings, read-only). `reviewer-security` states the assets it assumed instead of stopping when the brief has no threat model. `theme` lists the places that hardcode agent names. `session-start-framing.md` and `docs/usage.md` gain a spec-first line.
- **`orchestrator-loop`.** Its spec-first trigger reads "unsettled design", matching `spec-review`; the duplicate compass emoji is fixed (orchestrator-loop 🎛️, spec-review 📝); commits stay in the main session except the release manager's release commits, pushes and tags; delegation announcements are no longer "narration" and a blocker or anything destructive or irreversible is surfaced at once (routine errors still wait for the report); a new delegation rule says the orchestrator fills an offensive-testing scope block only from the human's own quoted approval in the conversation.
- **Offensive agents (H4).** `testing-red-team` and `testing-pentester` need a scope block in the brief (targets, owner, allowed techniques, exclusions, time window); without one they work only on the local repository and local instances, never production or third-party hosts. The default boundary allows non-destructive, read-only techniques only. The human's approval is given before the engagement, in the conversation, and the scope block records it in an `Approved by: {name}, {when}, {quoted approval}` line; a missing line means stop and return. Secret probing prints names, locations or fingerprints, never values, with named forms (scanners only with their redact option, `grep -l`/`-c`, environment as names only; a tool whose default output includes the match is forbidden without its redact option). The pentester may look up package registries and advisory databases for CVE data; the red team touches only in-scope targets. "Stop and ask" and "wait for confirmation" become "stop and return". Both gain the Write tool for probe files only, with the wording `reviewer-code` got in 0.11.1.
- **Release manager and tags.** `release-manager` keeps making the release commit and pushing it, and tagging is now explicit: an annotated `v<version>` tag, created only after the release commit is pushed and the remote main SHA confirmed (`git tag -a vX.Y.Z <sha> -F <file>`), then pushed and verified with `git ls-remote`, never moved once published. It gains Grep and Glob. The release convention is recorded in this file's header, `docs/usage.md` and `docs/agents.md`.
- **Site (H5).** `site/index.html` is current (14 agents, 5 skills, the UX Reviewer, aliases, spec-review, the crew card). `site/render.py` reads the skill count from `skills/` instead of a hardcoded "four skills". The Pages workflow now sets up Python, installs `markdown==3.10.3`, renders the docs pages itself, and triggers on `site/**`, `docs/**`, `skills/**` (the skill count is read from there) and `ROADMAP.md`; the rendered HTML is no longer committed (gitignored), because deploy does not need it and a committed copy is what went stale. This also corrects the 0.11.0 note that the site had been regenerated: it had not (L6).
- **Leftovers (M6).** `scripts/subagent-status.sh` knows `reviewer-ux`; ROADMAP counts say fourteen and its `brief` item is rescoped to what `spec-review` does not cover; `docs/agents.md` names the architect's spec-review role.

## [0.12.0] - 2026-11-23

### Added
- **`spec-review` skill.** The orchestrator writes the spec (marks `[V]` verified, `[I]` inferred, `[Q]` open) and any ADR, a fresh Fable reviewer (`architect` agent, `model: "fable"`) critiques it with a verdict line and evidenced findings, and the two iterate on the same reviewer through `SendMessage` until both approve; disagreements still open after two rounds go to the user. The approved spec is then presented (summary, `[Q]` decisions, open risks, implied version bump) and building starts only on the user's go, or at once when the user said "build once approved". Includes the reviewer brief template and a must-not list.

### Changed
- `orchestrator-loop` sends substantial features with open design questions through `spec-review` before any builder is spawned.
- `model-routing` matrix gains a "spec review" row on Fable (JSON source and readable view).
- Skill counts in README, `docs/install.md` and `docs/skills.md` now say five.

## [0.11.1] - 2026-11-17

### Changed
- **`reviewer-code` gains the Write tool, for probe files only.** A reviewer that needed a few lines to reproduce a bug had Bash but no Write, so it built the file through the shell (a heredoc, a redirect, an interpreter one-liner), which is fragile on quoting and is refused by shell guards that block file edits from the command line. It now writes probe files with Write, only under a temp or scratch directory, runs them by path, and lists each one at the end of the review. The trade, stated plainly: the Code Reviewer is no longer read-only by construction, only by instruction. It still never changes a file in the project. `reviewer-security` and `reviewer-ux` are unchanged (no Bash, no Write).

## [0.11.0] - 2026-10-12

### Added
- **`switchboard-crew`, a companion mod** (`crew/`, listed in this marketplace as its own plugin): the roster at work as pixel crabs, one costume per role. A band above the prompt follows the plan `orchestrator-loop` reports, or the agents running when none is reported; the `/crew` panel lists every subagent of the session with its role, model and effort, context, estimated cost and time, and the verdict each reviewer returned. Themed rosters keep their costumes (agents are recognised by their description emoji). It only observes, and ships separately so the core plugin stays free of always-on hooks and of the early-access mods API. Needs Claude Code 2.1.291 or later. Its model-callable `progress` tool bounds every count, list and text it is given. Crab body and walk adapted from savvy-progress (MIT); see `crew/NOTICE`.
- `orchestrator-loop` gains a short "Report the plan to the crew band" section: when the crew mod is installed, report the plan, each accepted task and the close through its `progress` tool. Skipped entirely when the mod is absent.

### Fixed
- **`orchestrator-loop` frontmatter now parses.** Its unquoted `description` held `: `, which YAML reads as a nested mapping, so the skill loaded with empty metadata and its description never reached the model's skill listing (`claude plugin validate .` reported it). The description is now quoted; the text is unchanged.
- **Docs site regenerated.** `site/agents.html` still showed the 13-agent roster: the 0.10.0 UX Reviewer and its row never reached the rendered page.

## [0.10.1] - 2026-10-08

### Changed
- **Model pins moved to the current generation.** Every agent and task tier on `claude-opus-5` now uses `claude-opus-5-5`, `claude-sonnet-5` moves to `claude-sonnet-5-5`, and `claude-fable-5` moves to `claude-fable-5-1` (agent frontmatter, `model-matrix.json`, `model-matrix.md`, `docs/agents.md`, `site/agents.html`). The security tier (`reviewer-security`, `testing-red-team`, `testing-pentester`) and the orchestrator `trigger_model` stay on `claude-opus-4-8` by decision. Haiku is unchanged.
- **Classifier and fallback notes corrected** against the Claude Code model-config doc (verified 2026-10-08). The guard is not Fable-only: Fable 5.1, Fable 5, Opus 5.5, Sonnet 5.5 and Opus 5 all run safety classifiers. Cyber-flagged requests re-run on Opus 4.8 (Sonnet 5.5: on Sonnet 5), bio-flagged on Opus 5 or refused, the session stays on the fallback until `/model`, and inside a subagent the re-run happens without a prompt. Ordinary coding content is not a documented trigger, so the old "Fable auto-swaps to Opus on code" rationale is gone. `switchModelsOnFlag=false` makes the main session ask instead of switching.

## [0.10.0] - 2026-09-10

### Added
- **🧭 UX Reviewer** (`reviewer-ux`, claude-opus-5) - the roster's fourteenth agent and the missing counterpart to the Code and Security Reviewers: it reviews a UI decision, design spec, or built interface against WCAG 2.1 AA by success criterion, ARIA Authoring Practices patterns, Nielsen's heuristics, and enterprise form and data-grid conventions, and issues the same three-verdict quality gate the Code Reviewer uses. Every finding must name the standard it violates and a concrete user-facing failure; preference is explicitly not a finding, and stated non-goals are not findings. It reviews only - the Designer authors, the Frontend Developer implements - and it declares that it cannot see rendered output, so contrast and layout checks are flagged for a human or tool rather than asserted from source. Matrix row, roster count, docs, orchestrator emoji line, and theme role list updated to match.

### Changed
- `roster-smith`'s roadmap entry now names its honest hard part: where a minted specialist lands (a user overlay that composes with the installed plugin and survives an update) and how its matrix row merges with the shipped `model-matrix.json`. Records that roster state lives in eight places, not one, which is the argument for landing `doctor` before the generator.

## [0.9.10] - 2026-08-27

### Added
- The repo is now a one-plugin **marketplace** (`.claude-plugin/marketplace.json`), so it installs by name and persists: `claude plugin marketplace add cogghaus/switchboard` then `claude plugin install switchboard@switchboard`.

### Changed
- Install docs (install.md, README, site landing) lead with the marketplace install. Clarified that `--plugin-dir` is the plugin's own directory and session-only, not a parent "plugins" folder that gets scanned.

## [0.9.9] - 2026-08-27

### Added
- Roadmap page on the docs site, rendered from `ROADMAP.md` (left-rail entry and a landing Documentation card). `site/render.py` now also renders the repo-root `ROADMAP.md`.
- A public roadmap voting discussion (GitHub Discussions, Ideas category), linked from the roadmap: react with 👍 and reply to help prioritize.

## [0.9.8] - 2026-08-27

### Changed
- Emoji added to the model-routing matrix: a leading `emoji` field in `model-matrix.json` and an `emoji` column in the generated `model-matrix.md`.
- Agents reference table restructured so the emoji is its own leading column (emoji | Agent | slug | model | use when) and enlarged for visual clarity.

## [0.9.7] - 2026-08-27

### Changed
- Docs site redesigned into a two-column layout with a persistent left-rail table of contents (the four docs, with the active doc's sections nested beneath it). The hero `Docs` button now opens the docs (Usage page) instead of scrolling to a section.
- Emoji attached to every agent reference - the agents doc table and blurbs, the README roster, and the site roster now lead each agent with its emoji - to reinforce the visual-to-name association.
- Fixed a garbled sentence in reviewer-security's Secure Patterns (caught by the Fable re-review, which otherwise graded the roster prime-time ready with all 13 passing).

## [0.9.6] - 2026-08-27

### Added
- Agent visibility: every agent has an emoji, and the orchestrator loop now announces the specialist or skill emoji on each delegation and report, so which agent is working is visible in the transcript. Emoji added to each agent's `description` (shown in the picker). Optional `scripts/subagent-status.sh` renders a live emoji status line in the subagent panel (opt-in; see install docs).
- A `Docs` button in the site hero, between Install and GitHub.

### Changed
- Agent quality pass from the Fable review: reviewer-security reconciled to a read-only auditor (active dependency scanning routed to the infra pentester; dropped the two stop conditions it could not satisfy); an output-path convention added to business-analyst, designer, and technical-writer; the visual-verification limitation stated honestly in designer, frontend-developer, and QA; test-first-for-bug-fixes added to the two build agents.

## [0.9.5] - 2026-08-27

### Changed
- Reorganized the website into its own `site/` folder; `docs/` now holds only the markdown sources. The site deploys via a GitHub Pages Actions workflow (`.github/workflows/pages.yml`) so the dedicated folder can be served, and the public URL is unchanged. `site/render.py` reads the markdown from `../docs`.

## [0.9.4] - 2026-08-27

### Added
- Rendered in-site documentation pages (usage, agents, skills, install) styled to match the site, generated from the markdown by `docs/render.py` and sharing `docs/docs.css`. The landing page's Documentation section now links to these rendered pages instead of GitHub.

## [0.9.3] - 2026-08-26

### Added
- Public landing and setup site (`docs/index.html`, served via GitHub Pages): install walkthrough, roster overview, setup options, and links into the docs.

## [0.9.2] - 2026-08-26

### Added
- `docs/` set: `usage.md` (the orchestrator workflow), `agents.md` (per-agent reference), `skills.md` (per-skill reference), and `install.md` (install, sharing, theming, wiring into a project). The README links them under a Documentation section.

## [0.9.1] - 2026-08-26

### Added
- MIT LICENSE file and a matching `license` field in the plugin manifest, making reuse terms explicit ahead of going public.

## [0.9.0] - 2026-08-26

### Changed
- Top-down refactor / efficiency / quality pass across the whole plugin, driven by a three-part audit.
- Normalized section headings across all 13 agents to one skeleton (Operating Principles, Domain, Working Method, Outputs, Trust Boundary, Completion, When to Stop and Escalate); role-specific blocks (Release Protocol, Review Protocol, Story/Bug/Report formats, and so on) kept.
- Added Role lines to the three security agents; added a Trust Boundary to Loki; gave release-manager a standalone Completion section.
- Dropped Bash from technical-writer (least privilege; it executes nothing).
- Matrix: set the three 4.8-pinned security agents' alias to `n/a` (an alias must not be relied on to reach the pinned tier); de-dated and de-plan-specified the notes for portable team distribution; corrected the matrix view header to describe it as a derived view of the JSON source rather than the output of a shipped database pipeline.
- orchestrator-loop no longer re-lists the roster (it points at the matrix and README), removing a maintenance sync point.
- theme skill: documented Loki as the one intentional themed default, and noted that the corporate baseline ships with no `theme.json`.

### Added
- Plugin manifest: `author`, `homepage`, `repository`, and `keywords` fields.

### Removed
- A dead CSS class and a tool-attribution comment from the brand wordmark.

## [0.8.0] - 2026-08-26

### Added
- orchestrator-loop as the default operating mode: a trigger-rich description for best-effort auto-invocation, plus an opt-in per-user `SessionStart` hook (`skills/orchestrator-loop/session-start-framing.md`) for a deterministic always-on default, with no footprint forced on coworkers.

## [0.7.0] - 2026-08-26

### Added
- `wireup` skill: connects the roster to a specific project as a reviewed, merge-safe overlay - hooks and MCP servers into the project's own config (project-scoped, credentials as env-var references), LSP recommended rather than written since it is a plugin-only surface.

## [0.6.0] - 2026-08-26

### Changed
- Matrix cleanup: dropped the non-shipped orchestrator row and the unenforceable per-agent override column; purged stale slugs and operator-specific references; re-tiered business-analyst (Opus 5 to Sonnet).

### Added
- Agent audit fixes: scoped Bash and honest test reporting for the build/test agents; tool allowlists reconciled to each persona; trust-boundary sections on architect and business-analyst; removed the dated context-saturation hedge.

## [0.5.0] - 2026-08-26

### Changed
- Grouped-taxonomy agent slugs (developer-*, reviewer-*, testing-*, writer-*); restored the challenger as Loki.

### Added
- `designer` agent (product and UX design).

## [0.1.0] - [0.4.0] - 2026-08-26

- Initial specialist roster, the `model-routing` and `orchestrator-loop` skills, the generative `theme` skill, and the Switchboard rebrand with brand assets.
