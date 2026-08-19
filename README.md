# Open ChipAgents

Open ChipAgents is a small, educational package for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It provides
two project-local skills and a constrained execution plugin:

- `macos-rtl2gds` installs and verifies an Apple Silicon-native open-source
  RTL-to-GDS environment with LibreLane, Nix, and SKY130A.
- `sky130-sha256-lab` guides a fixed SHA-256/SKY130A experiment from RTL
  simulation through synthesis, place-and-route, and DRC.
- `dsh-sky130-flow` exposes the deterministic EDA flow to DSH through an
  allow-listed tool that accepts only `simulation`, `synthesis`, `pnr`, `drc`,
  or `all`.

The DeepSeek model selects and explains each stage; Icarus Verilog, Yosys,
OpenROAD, OpenSTA, OpenRCX, KLayout, Magic, and Netgen produce the actual
evidence and artifacts.

## Quick start

Prerequisites: an Apple Silicon Mac, macOS 13 or newer, Xcode Command Line
Tools, and approximately 12 GiB of free disk space. The Nix installation creates
the system-level `/nix` store; review the command and enter your administrator
password only in the macOS prompt.

```bash
git clone https://github.com/bitteak/Open-ChipAgents.git
cd Open-ChipAgents

# Install Nix and configure the FOSSi Foundation binary cache.
./.dsh/skills/macos-rtl2gds/scripts/install-nix-macos.sh

# Install the pinned LibreLane toolchain and SKY130A, then run a GDS smoke test.
./.dsh/skills/macos-rtl2gds/scripts/bootstrap-toolchain.sh

# Install the constrained flow plugin into the DSH web profile.
./install.sh --profile web --harness-root /path/to/deepseek-harness

# Launch DSH from this project so both project-local skills are discovered.
./bin/dsh-open-chipagents --profile web --harness-root /path/to/deepseek-harness
```

In the DSH Web UI, select the cloned `Open-ChipAgents` directory as the
workspace, create a new session, and invoke either skill:

```text
/macos-rtl2gds Inspect and verify the local RTL-to-GDS environment.

/sky130-sha256-lab Run the complete SHA-256 flow through DRC and summarize the evidence.
```

## License

Original material in this repository is MIT-licensed. Downloaded dependencies,
the SKY130A PDK, and third-party RTL are governed by their upstream licenses.
