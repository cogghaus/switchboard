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
| 2. Approved by is a named person's own quoted approval, but another field missing, empty or a placeholder | Work only inside the default boundary, read-only. The fields that are present can narrow it, never widen it. | Which fields were missing and what that left untested. |
| 3. Approved by missing, or not a named person's own quoted approval | Test nothing and return. | That nothing was tested and why. |

Check row 3 first: whenever row 3 matches, it applies, whatever else the block holds.

Time window: check the system clock before starting and before each active test, in the time zone the block states; if the block states none, treat the window as missing (row 2).
