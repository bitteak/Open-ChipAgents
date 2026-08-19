---
name: sky130-sha256-lab
description: Run, teach, or interpret the fixed SHA-256/SKY130A experiment through the constrained DeepSeek Harness tool `sky130_sha256_flow`. Use when a user asks for RTL simulation, synthesis, placement and routing, DRC, a complete `all` run, artifact locations, metric interpretation, or the distinction between DRC acceptance and timing signoff.
---

# SKY130 SHA-256 Lab

Use the model-facing `sky130_sha256_flow` tool as the execution backend. Do not
replace it with arbitrary shell commands when the tool is available.

## Preflight

Run `scripts/doctor.sh` only when the tool is missing or a call reports an
environment/path error. If the plugin is not installed, direct the user to run
the repository's `install.sh` and restart the DSH profile. If the PDK or EDA
environment is missing, load and follow `macos-rtl2gds` first.

## Choose one stage

- `simulation`: verify the RTL against FIPS 180-4 vectors with Icarus Verilog.
- `synthesis`: run Slang/Yosys through mapped synthesis and require zero
  unmapped cells.
- `pnr`: run through OpenROAD detailed routing and require ODB and DEF outputs.
- `drc`: run through route, Magic, and KLayout DRC.
- `all`: run RTL simulation, then a fresh physical flow through DRC.

Call `sky130_sha256_flow` exactly once with the requested stage. Omit `run_tag`
unless the user needs a stable label. If supplied, use only lowercase letters,
digits, dots, underscores, and hyphens, with at most 64 characters.

## Interpret the result

Read `references/metrics-and-signoff.md` before explaining metrics or making a
pass/signoff claim.

Report:

1. requested and completed stages;
2. PASS or FAIL from the structured result;
3. unmapped cells and generated ODB/DEF/GDS evidence when applicable;
4. route, Magic, and KLayout DRC counts;
5. setup and hold WNS as a separate timing statement;
6. stable artifact paths and the run tag.

On failure, summarize only the returned bounded log tail and point to the full
flow log. Do not paste an entire EDA log into model context.

## Claims boundary

Say “accepted through DRC” only when the requested DRC checks are zero. Say
“timing clean” only when setup and hold constraints both pass. Never equate a
DRC-clean layout with full signoff or tape-out readiness. The current experiment
does not establish production power integrity, packaging, reliability, or
foundry submission readiness.
