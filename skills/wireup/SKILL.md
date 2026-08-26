---
name: wireup
description: Connect the Switchboard roster to a specific project by setting up its environment integration - hooks, MCP servers, and code-intelligence (LSP) - as a reviewed overlay on the project's own config. Use once per codebase, or when the toolchain changes.
---

# Wireup

Switchboard's roster is portable: it works in any Claude Code session with no per-project setup. This skill adds the optional layer that makes the roster *sharper on one codebase* - real code intelligence, project MCP tools, and convention-enforcing hooks - by writing into the **target project's own config**, never into the shipped plugin.

Why the project and not the plugin: a plugin's shipped sub-agents are deliberately forbidden from declaring `hooks`, `mcpServers`, or `permissionMode`, so integration cannot live in the agent files. Project-level hooks and MCP servers, by contrast, apply to the whole session **including delegated Agent-tool subagents** - which is exactly the roster. So that is where they belong.

## The three surfaces

| Surface | Where it lives | Scope | Set by wireup? |
|---|---|---|---|
| **Hooks** | `<project>/.claude/settings.json` | Project (applies to subagents too) | Yes - overlay |
| **MCP servers** | `<project>/.mcp.json` (repo root) | Project (committed, shared with the team) | Yes - overlay |
| **LSP / code intelligence** | `.lsp.json` (plugin root only) | Plugin-only - **cannot** be set per project | Recommend, do not silently write |

## The flow (always in this order)

1. **Detect the stack.** Read what the project actually is - `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml`, the test runner and linter/formatter in use, `.github/workflows` or other CI, the git remote host (issue tracker), any database or infra config. Do not assume a layout.
2. **Propose an overlay.** For each surface, draft only what fits the detected stack. Present it to the user as a plain list: what file, what entries, and for hooks, exactly what command each one runs.
3. **Get explicit approval.** These are the user's own project files and they are side-effectful - hooks execute commands, MCP servers reach external services. Nothing is written until the user approves. Approval is per-surface; they may take hooks and skip MCP, or vice versa.
4. **Merge, never clobber.** Read the existing config first. Add only missing entries; preserve everything already there. Show the before/after for anything you change. If an entry already exists with different content, ask - do not overwrite.
5. **Verify.** After writing, confirm the JSON parses and (for MCP) that the server is reachable / listed. Report what was written and what was skipped.

## Hooks - `<project>/.claude/settings.json`

Enforce the project's conventions automatically. Propose only hooks whose command actually exists in the detected stack. Common, high-value ones:

- **PostToolUse** on `Edit|Write` - run the project's formatter, then linter, on the changed files. Keeps every agent's output conforming without the agent having to remember.
- **PostToolUse** on `Edit|Write` - run the fast test subset when a source file changes (only if the suite is quick; never a slow full run on every edit).
- **PreToolUse** on `Bash` - guard genuinely destructive commands for this project (a project-specific block, not a general one).

Skeleton (merge into the existing `hooks` object, do not replace it):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/format.sh", "timeout": 60 }
        ]
      }
    ]
  }
}
```

Use `${CLAUDE_PROJECT_DIR}` for paths so the config is portable across clones. Write any hook scripts under `<project>/.claude/hooks/` and make them executable. Keep each hook fast; a slow PostToolUse hook taxes every edit.

## MCP servers - `<project>/.mcp.json`

Connect the roster to the codebase's ecosystem: a code index, the issue tracker, CI, internal docs, a database. Propose servers that match what you detected (e.g. a GitHub server when the remote is GitHub, a Postgres server when there is a DB config). Skeleton (merge into `mcpServers`):

```json
{
  "mcpServers": {
    "example-stdio": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@scope/some-mcp@latest"],
      "env": { "SOME_TOKEN": "${SOME_TOKEN}" }
    },
    "example-http": {
      "type": "http",
      "url": "https://mcp.example.com",
      "headers": { "Authorization": "Bearer ${EXAMPLE_TOKEN}" }
    }
  }
}
```

`.mcp.json` is committed and shared with the team, so it must be value-free: reference every credential as an environment variable (`${SOME_TOKEN}`), never inline a real token. If a server needs a secret, tell the user which env var to set in their own environment - do not ask for the value and do not write it to the file.

## LSP - recommend, do not silently write

Code intelligence (go-to-definition, find-references, diagnostics, safe rename) turns the build and review agents from text-search into symbol-aware. But `.lsp.json` is a **plugin-only** surface: it cannot be set at the project level, and writing it into the shared Switchboard plugin would make the shared package stack-specific. So do not silently edit the plugin. Instead, present the options and let the user choose:

1. **Enable a prebuilt LSP plugin** for the language (Anthropic maintains these for common stacks) - the clean choice for a supported language.
2. **Ship a companion plugin per stack** - a small separate plugin carrying just a `.lsp.json` for this team's language, installed alongside Switchboard. Keeps the core portable.
3. **Add `.lsp.json` to your own fork** of Switchboard - only if this install is not shared with a team on other stacks.

`.lsp.json` shape, for reference (top-level key per language):

```json
{
  "python": {
    "command": "pyright-langserver",
    "args": ["--stdio"],
    "extensionToLanguage": { ".py": "python" }
  }
}
```

## Guardrails

- **Show before write, approve per surface.** Hooks run commands and MCP servers reach out; the user sees exactly what each will do before anything lands.
- **Merge, never overwrite.** Preserve the user's existing hooks, MCP servers, and settings. Add; do not replace. Conflicts are a question, not a silent decision.
- **No secret values in config.** `.mcp.json` is committed - every credential is an `${ENV_VAR}` reference. Never solicit or write a real token.
- **Keep the core portable.** Project integration goes in the project. Never write stack-specific config into the shipped Switchboard plugin, and never add hooks/MCP/permission fields to the agent files (plugins forbid it anyway).
- **Idempotent.** Running wireup twice on the same project changes nothing the second time.
