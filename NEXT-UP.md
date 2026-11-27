# Next up

Hub: cogghaus/hub#64

## Now

- [ ] Housekeeping: delete merged or superseded branches (local and remote: `feat/crew-off-pin`,
      `feat/crew-off-pin-0.1.1`, `feature/switchboard-review`, `feat/reviewer-code-write`,
      `review-0.13`, `feat/crew-mod`, `feat/spec-review`); pull `G:\dev\switchboard` (main is behind).

## Next

- [ ] CI drift check, the 1.0 gate (#15): `claude plugin validate`, shared agent blocks byte-identical,
      matrix vs agent frontmatter vs docs and site.
- [ ] Smoke runs of business-analyst, testing-pentester, testing-red-team (never used); the two
      security agents against a throwaway local repo with a scope block Adam approves.
- [ ] #15 Medium cleanups as one patch release.
- [ ] Plugin icon (512-2048 px PNG); owner-specific text out of the public repo (see Decisions).

## Decisions needed (Adam)

- Whether this file and the hub pointer in CLAUDE.md stay in the public repo or move to
  `*.local.md` (gitignored); the hub sweep reads NEXT-UP.md from origin's default branch.

## Done

- 2026-11-26: 0.14.0 released (PR #13, tag v0.14.0). 2026-11-27: crew 0.1.1 off-pin marker (PR #16).

_Last updated: 2026-11-27_
