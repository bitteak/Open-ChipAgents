# Metrics and signoff language

## Functional and synthesis evidence

- Simulation passes only when the testbench prints
  `ALL FIPS 180-4 TESTS PASSED` and the wrapper reports
  `SHA-256 RTL simulation: PASS`.
- `unmappedCells = 0` means synthesis mapped every design cell. It does not
  prove logical equivalence or post-layout functionality by itself.

## Physical evidence

- ODB and DEF show that the flow reached physical implementation.
- GDS is the streamed layout artifact; its existence alone is not a clean DRC
  or LVS result.
- `routeDrcErrors`, `magicDrcErrors`, and `klayoutDrcErrors` are separate
  checkers. State each available count rather than merging them into one vague
  “DRC passed” claim.

## Timing evidence

- Setup WNS below zero means the design misses the setup constraint.
- Hold WNS below zero means the design has a hold violation.
- DRC can pass while timing fails. Describe that result as “DRC clean, not
  timing clean,” never “signoff passed.”

## Educational acceptance

This lab's `all` stage is accepted when simulation passes, synthesis has zero
unmapped cells, PnR artifacts exist, and all three requested DRC counts are
zero. Timing, LVS, antenna, power integrity, and reliability remain separate
signoff dimensions unless explicitly run and reported.
