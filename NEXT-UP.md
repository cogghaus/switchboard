# Next up

Hub: cogghaus/hub#64

## Now

- [ ] Soak toward 1.0: use 0.14.1 in real work for about two weeks with the formats unchanged
      (#15, "Toward 1.0" item 1). Watch the weekly `validate-latest` run.

## Next

- [ ] Main Switchboard plugin icon (512-2048 px PNG): on hold until the owner picks a design.
- [ ] #21: check `crew/hooks/sprites.ts` against its generator in CI; make the crew icon rebuildable.
- [ ] At 1.0: make the `validate` CI check required too, if it stayed quiet through the soak
      (cogghaus/hub#80).
- [ ] Backlog from the 0.14.1 decisions: the wireup shell-write guard hook (D11); merging the
      orchestrator-loop skill text and its SessionStart hook text into one file (D10, after a design
      note).

## Decisions needed (Adam)

- None open.

## Done

- 2026-11-26: 0.14.0 released (PR #13, tag v0.14.0). 2026-11-27: crew 0.1.1 off-pin marker (PR #16).
- 2026-11-27: CI drift check, the 1.0 gate (PR #18): `drift` (required) and `validate` jobs, weekly
  `validate-latest`; ruleset on `main` (PR required, `drift` required, no bypass).
- 2026-11-27: smoke runs of business-analyst, testing-pentester and testing-red-team, all useful;
  their definition gaps fed #15.
- 2026-11-27: crew 0.2.0, new 32x32 crab sprites and an operator plugin icon (PR #22).
- 2026-11-28: the owner-specific hub section moved out of the public repo to `CLAUDE.local.md`
  (gitignored); this file stays public because the hub sweep reads it (PR #23).
- 2026-11-28: 0.14.1 released (PR #24, release PR #25, tag v0.14.1): the #15 cleanups across the
  agents, skills and docs, with the security agents' scope and secret rules reviewed by
  reviewer-security and the owner (D2).

_Last updated: 2026-11-28_
