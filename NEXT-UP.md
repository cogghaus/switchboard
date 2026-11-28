# Next up

Hub: cogghaus/hub#64

## Now

- [ ] #15 Medium cleanups as one release: requirements and a recommended cut are written; the owner
      decisions (release label, security-agent scope text, WCAG version, tool changes) come first.

## Next

- [ ] Main Switchboard plugin icon (512-2048 px PNG): on hold until the owner picks a design.
- [ ] #21: check `crew/hooks/sprites.ts` against its generator in CI; make the crew icon rebuildable.
- [ ] At 1.0: make the `validate` CI check required too, if it stayed quiet through the soak
      (cogghaus/hub#80).

## Decisions needed (Adam)

- The #15 cleanup decisions (D1 to D12 in the requirements notes).

## Done

- 2026-11-26: 0.14.0 released (PR #13, tag v0.14.0). 2026-11-27: crew 0.1.1 off-pin marker (PR #16).
- 2026-11-27: CI drift check, the 1.0 gate (PR #18): `drift` (required) and `validate` jobs, weekly
  `validate-latest`; ruleset on `main` (PR required, `drift` required, no bypass).
- 2026-11-27: smoke runs of business-analyst, testing-pentester and testing-red-team, all useful;
  their definition gaps feed #15.
- 2026-11-27: crew 0.2.0, new 32x32 crab sprites and an operator plugin icon (PR #22).
- 2026-11-28: the owner-specific hub section moved out of the public repo to `CLAUDE.local.md`
  (gitignored); this file stays public because the hub sweep reads it.

_Last updated: 2026-11-28_
