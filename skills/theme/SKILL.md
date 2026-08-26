---
name: theme
description: Reskin the Switchboard agent roster to a naming theme. Use to keep the default corporate roster or apply a custom theme - name any subject (a show, game, universe, or motif) and each agent is renamed to a fitting character from it, with its function unchanged.
---

# Theme

Switchboard ships with a plain corporate roster (Security Reviewer, Backend Developer, and so on). This skill reskins that roster to any theme the user wants, without changing what any agent does. Reskinning is cosmetic: names, and at most one flavor line, per agent.

## The flow

1. Ask the user: **keep the default corporate roster, or apply a custom theme?** If custom, ask for a subject - a show, game, universe, or any motif (for example Fallout, Rick and Morty, a Norse pantheon).
2. Map each role to a name from that subject whose character or vibe fits the role's FUNCTION (see the role reference below). Aim for apt, recognizable picks: the security reviewer should feel like a guardian, the red-teamer like an adversary, the lateral thinker like the contrarian. (A Fallout theme, say, yields a frontend named Pip-Boy and a lateral thinker named Dogmeat.)
3. Present the proposed roster to the user as a role -> themed-name table. Let them veto or swap any pick before anything is written.
4. On approval, apply it (see Apply).

## Role reference (map by FUNCTION, not by the current name)

- reviewer-security - defensive security review; a guardian / protector.
- testing-red-team - offensive application-security testing; an adversary.
- testing-pentester - infrastructure and supply-chain attack testing; a saboteur of foundations.
- developer-backend - servers, data, APIs; a builder / engineer.
- developer-frontend - the UI and user-facing surface; the face / interface.
- designer - product and UX design, user journeys and wireframes; the visionary / artisan.
- testing-qa - finds defects; the all-seeing inspector.
- reviewer-code - the quality gate, issues verdicts; the judge.
- architect - system design and trade-offs; the master planner.
- business-analyst - requirements and what to build; the seer / interpreter.
- writer-technical - docs and the knowledge base; the chronicler / scribe.
- release-manager - versioning and shipping; the herald / deliverer.
- loki - challenges assumptions, surfaces lateral alternatives; the contrarian / trickster.

(architect is a plain role word already, so many themes leave it or give it a planner/inventor character.)

## Apply

For each agent file in `agents/`:
- Change the `name:` frontmatter to a kebab-case slug of the themed name, unique across the roster, and the `# H1` title to the themed name.
- Optionally add ONE short themed flavor line at the top of the Identity section - a nod to the character. Keep every functional section (principles, method, output format, tools, model, when-to-stop) exactly as-is.
- Do NOT change `tools`, `model`, `description`, or any functional or safety instruction. The security agents (reviewer-security, testing-red-team, testing-pentester) keep `model: claude-opus-4-8` whatever their new name.

Then keep the roster consistent:
- Update the model matrix: `skills/model-routing/model-matrix.json` (each agent's `agent_id` and `display_name`), then regenerate `model-matrix.md` to match.
- Update the roster lists in `README.md` and in the `orchestrator-loop` skill to the new names.
- Record the applied theme and the full role -> name mapping in `theme.json` at the plugin root, so a reskin is revertible. The value `corporate` restores the shipped defaults.

## Guardrails

- Reskinning is names and one flavor line only. A theme must never change an agent's tools, model, safety instructions, or role.
- Keep the mapping legible: a stranger reading the themed roster next to this role reference should be able to tell which agent is which. If a themed pick is too obscure, prefer clarity.
- Filenames stay as the stable role slugs (reviewer-security.md, and so on); only `name:`, the `# H1`, and the optional flavor line change - so re-theming is repeatable and reversible.
