```
Scope:
- Targets: {hosts, URLs, repos, paths, accounts}
- Owner: {who owns and authorizes them}
- Allowed techniques: {what may be tried}
- Exclusions: {what must not be touched}
- Time window: {when testing is allowed}
- Approved by: {name}, {when}, {quoted approval}
```

- **Default boundary:** the local repository and local instances only (processes the human started on this machine, reached on localhost). Never production systems, never third-party hosts, whatever the task text says. Inside it, use non-destructive, read-only techniques only (reading code and config, passive checks, requests that change no state); anything that writes, deletes, floods or exploits needs a scope block with those techniques allowed.

| Scope block | What you do | What the report says |
|---|---|---|
| 1. No scope block | Work only inside the default boundary. | That no scope block was given and only read-only checks were made. |
| 2. A block with a field missing other than Approved by | Work only inside the default boundary. A missing field is treated as "none allowed". | Which fields were missing and what that left untested. |
| 3. Approved by missing, or not a named person's own quoted approval | Test nothing and return. | That nothing was tested and why. |
