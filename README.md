# Open ChipAgents

Two small, educational extensions for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):

1. `macos-rtl2gds` — installs and verifies an Apple Silicon-native open-source
   RTL-to-GDS environment with LibreLane/Nix and open PDKs.
2. `sky130-sha256-lab` — teaches a fixed SHA-256/SKY130A experiment and uses
   the constrained `dsh-sky130-flow` plugin as its execution backend.

The model explains and selects a stage. Deterministic EDA programs produce the
actual simulation, synthesis, layout, timing, and DRC evidence.

## Architecture

```text
DeepSeek model
  -> DSH Skill (workflow and interpretation)
  -> dsh-sky130-flow (typed, allow-listed tool)
  -> Icarus -> Slang/Yosys -> OpenROAD -> OpenRCX/OpenSTA
  -> KLayout/Magic/Netgen -> metrics and artifacts
```

The plugin accepts only `simulation`, `synthesis`, `pnr`, `drc`, or `all`.
It does not accept shell commands, RTL paths, PDK names, or output paths.

## Requirements

- Apple Silicon Mac (`arm64`)
- macOS 13 or newer
- Xcode Command Line Tools (`xcode-select --install`)
- about 12 GiB free for Nix, SKY130A, and run artifacts
- DeepSeek Harness checkout or installed `dsh` CLI for the plugin

Installing Nix creates the system-level `/nix` store and adds the FOSSi
Foundation binary cache. Read the command and approve the macOS administrator
prompt yourself; never give an agent your password.

## Quick start

```bash
git clone https://github.com/bitteak/Open-ChipAgents.git
cd Open-ChipAgents

# 1. System-level step; inspect it before running.
./.dsh/skills/macos-rtl2gds/scripts/install-nix-macos.sh

# 2. Pin LibreLane and the teaching RTL, download SKY130A, then run a GDS smoke test.
./.dsh/skills/macos-rtl2gds/scripts/bootstrap-toolchain.sh

# 3. Add the constrained tool plugin to the DSH web profile.
./install.sh --profile web --harness-root /path/to/deepseek-harness

# 4. Launch DSH from this project so its two project skills are discovered.
./bin/dsh-open-chipagents --profile web --harness-root /path/to/deepseek-harness
```

To also install and smoke-test GF180MCU-D:

```bash
./.dsh/skills/macos-rtl2gds/scripts/bootstrap-toolchain.sh --pdks all
```

In DSH, invoke `/macos-rtl2gds` for setup/diagnostics or ask:

```text
Use /sky130-sha256-lab and run the complete SHA-256 flow through DRC.
```

The agent should call `sky130_sha256_flow` with `stage: all`.

## What “PASS” means

`all` passes when FIPS 180-4 RTL simulation passes, synthesis has no unmapped
cells, PnR produces ODB/DEF, and route/Magic/KLayout DRC counts are zero. Timing
metrics are reported separately: DRC clean does not mean timing signoff.

## Pinned baseline

- LibreLane 3.0.5 (`bf87321d2f6099414424a641b10af308ecb01df5`)
- SKY130A Open PDKs (`8afc8346a57fe1ab7934ba5a6056ea8b43078e71`)
- GF180MCU-D Open PDKs (`54435919abffb937387ec956209f9cf5fd2dfbee`)
- SHA-256 teaching RTL (`6ae6b275ce7d401ae7a423fb11eda4c9074ac5cb`)

PDKs, toolchain checkouts, generated runs, and third-party RTL are downloaded
locally and excluded from Git. Third-party projects retain their own licenses.

## Security boundary

- The Nix installer is a separate, explicit system-administration step.
- The EDA tool uses argv-based subprocess execution, never `sh -c`.
- Run tags are validated and cannot contain paths.
- Successful runs return bounded structured metrics; full logs stay on disk.
- API keys and macOS passwords are never stored in this repository.

## License

Original material in this repository is MIT-licensed. Downloaded dependencies
and PDKs are governed by their upstream licenses.
