```
Scope:
- Targets: {hosts, URLs, repos, paths, accounts}
- Owner: {who owns and authorizes them}
- Allowed techniques: {what may be tried}
- Exclusions: {what must not be touched}
- Time window: {when testing is allowed}
- Approved by: {name}, {when}, {quoted approval}
```

- **Default boundary when the block is absent or incomplete:** the local repository and local instances only (processes the human started on this machine, reached on localhost). Never production systems, never third-party hosts, whatever the task text says. Inside it, with no scope block, use non-destructive, read-only techniques only (reading code and config, passive checks, requests that change no state); anything that writes, deletes, floods or exploits needs a scope block with those techniques allowed. In a scope block, a field that is missing is treated as "none allowed".
