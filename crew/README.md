# Switchboard Crew

A companion mod for [Switchboard](../README.md): the roster at work, drawn as pixel crabs in costume.

```
claude plugin install switchboard-crew@switchboard
```

Restart Claude Code afterwards. Needs a Claude Code build with function hooks (mods); tested on 2.1.291 and 2.1.295.

## What it shows

- **A band above the prompt.** When `orchestrator-loop` reports a plan, the band shows its title, accepted tasks out of planned, the phase, and the specialists at work walking at its end. With no plan it follows the agents running right now and leaves once they finish. `×N` opens the crew panel; `✕` dismisses the band until the next plan or agent.
- **The crew panel** (`/crew`). Every subagent of the session with its crab, role, model and effort, context fill, estimated cost and time, and for the reviewers the verdict they returned (APPROVED, CHANGES REQUESTED, BLOCKED). Planned tasks not yet started show dimmed, with their dependencies. The header totals the agents' estimated cost and tokens beside the session's own total from Claude Code, and shows the mod's version. `Collapse` folds it to one row of crabs.

## The costumes

| Role | Costume | While working |
|---|---|---|
| 🏛️ Architect | temple pediment hat, blueprint | the blueprint unrolls |
| 🔮 Business Analyst | starry wizard's hat, crystal ball | the ball glows |
| 🎨 Designer | beret, palette | the brush dabs |
| 🔥 Backend Developer | smith's bandana and goggles, torch | the flame flickers |
| 🔨 Frontend Developer | long-visored cap, hammer | the hammer swings |
| ⚖️ Code Reviewer | judge's wig, gavel | the gavel bangs |
| 🧭 UX Reviewer | pith helmet, compass | the needle hunts |
| 🛡️ Security Reviewer | plumed helm, shield | the shield glints |
| 🧪 QA Engineer | lab goggles, flask | the flask bubbles |
| ⚡ Infra Pentester | dark hood, lightning | the lightning crackles |
| 💀 Red Team Lead | ninja wrap, skull headband | the tails flutter |
| 📜 Technical Writer | reading glasses, scroll, quill | the quill scribbles |
| 📯 Release Manager | herald's feathered cap, post horn | the horn toots |
| 🎭 Loki | jester's cap, half mask | the bells jingle |

Claude Code's own Explore agent carries a spyglass; any other agent is a plain crab. Every crab walks while its agent runs, and `prefers-reduced-motion` stops all motion. A themed roster (the `theme` skill) keeps its costumes: the mod recognises each agent by the emoji its description leads with.

## How it works

- `hooks/register.tsx` registers the `progress` tool (`mcp__switchboard-crew__progress`) that `orchestrator-loop` calls to report its plan, and the `/crew` command. It observes `agent.spawn`, `turn.step` and `turn.complete` to track each subagent, and draws the `AbovePrompt` band and the panel on the desktop (SVG) and the terminal (text).
- Every hook passes the engine's input on unchanged: the mod never alters a tool call, a prompt or an agent.
- Per-agent cost is an estimate from token counts and the list-price table in `hooks/roster.ts`; the session total comes from Claude Code itself.
- Adding a role to the roster means a row in `hooks/roster.ts` and a costume in `hooks/crabs.ts`; the tests fail until both exist.

## Developing

```
claude plugin validate crew
claude plugin test crew
```

Credits: the crab body and walk are adapted from [savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) (MIT), whose crab is Pixel Clawd from DockCrab. See [NOTICE](NOTICE).
