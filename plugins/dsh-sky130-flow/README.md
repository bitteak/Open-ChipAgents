# dsh-sky130-flow

A constrained DeepSeek Harness tool for the Open ChipAgents teaching project.
It exposes one model-facing tool, `sky130_sha256_flow`, with five stages:

- `simulation`
- `synthesis`
- `pnr`
- `drc`
- `all`

Install from the repository root:

```bash
./install.sh --profile web --harness-root /path/to/deepseek-harness
```

Launch through `bin/dsh-open-chipagents` so `OPEN_CHIPAGENTS_ROOT` and the PDK
root are set. The plugin otherwise uses its process working directory and the
project-local `chip-agent-lab/.cache/pdks/ciel` cache.

The tool never accepts commands, PDK names, RTL paths, or output paths. It
spawns fixed argv arrays and returns bounded structured metrics and artifact
locations. A DRC-clean result is not automatically timing-clean.
