# Pinned Apple Silicon toolchain

## Flow mapping

| Stage | Open-source implementation | Evidence |
|---|---|---|
| RTL simulation | Icarus Verilog (`iverilog`, `vvp`) | FIPS 180-4 empty-string and `abc` hashes |
| Parsing and synthesis | Slang frontend + Yosys/ABC | mapped netlist, zero unmapped cells |
| Floorplan, placement, CTS, routing | OpenROAD | ODB, DEF, routed netlist |
| Extraction and timing | OpenRCX + OpenSTA | parasitics and setup/hold metrics |
| Stream-out | KLayout and Magic | GDS artifacts |
| Physical checks | TritonRoute, Magic, KLayout | DRC counts |
| Connectivity checks | Netgen and KLayout | LVS reports |

LibreLane 3.0.5 supplies the pinned Nix environment for these binaries. The
toolchain runs natively on `aarch64-darwin`; it does not require Rosetta or a
Linux virtual machine.

## PDKs

- SKY130A is the default teaching target and uses five metal layers plus local
  interconnect. Its cached Open PDKs revision is
  `8afc8346a57fe1ab7934ba5a6056ea8b43078e71`.
- GF180MCU-D is optional. It is the supported five-metal variant with the
  thicker top metal and uses revision
  `54435919abffb937387ec956209f9cf5fd2dfbee`.

Ciel downloads versioned PDK builds below
`chip-agent-lab/.cache/pdks/ciel`. Do not commit or duplicate this data.

## Acceptance boundary

The GCD smoke test verifies that every major EDA stage can run and that output
artifacts are produced. DRC and LVS results are technology checks, while STA
depends on the supplied constraints. A smoke PASS is not a tape-out signoff.

The SHA-256 lab uses a 15 ns SKY130A clock target. Its educational acceptance
ends at DRC and reports timing separately; a negative setup WNS is a failure to
meet the timing target even if DRC is clean.
