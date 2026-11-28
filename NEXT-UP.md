# Next up

Hub: cogghaus/hub#64

## Now

- [ ] #15 Medium cleanups as release 0.14.1: owner decisions D1 to D12 are recorded on #15
      (https://github.com/cogghaus/switchboard/issues/15#issuecomment-7238672422); building next.

## Next

- [ ] Main Switchboard plugin icon (512-2048 px PNG): on hold until the owner picks a design.
- [ ] #21: check `crew/hooks/sprites.ts` against its generator in CI; make the crew icon rebuildable.
- [ ] At 1.0: make the `validate` CI check required too, if it stayed quiet through the soak
      (cogghaus/hub#80).

## Decisions needed (Adam)

- None open. The security agents' scope-text diff in the 0.14.1 PR goes to Adam for review (D2).

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
