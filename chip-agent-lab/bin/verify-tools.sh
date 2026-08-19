#!/usr/bin/env bash
set -euo pipefail

required=(librelane yosys openroad sta klayout magic netgen iverilog vvp verilator)

for tool in "${required[@]}"; do
    command -v "${tool}" >/dev/null
    printf '%-12s %s\n' "${tool}" "$(command -v "${tool}")"
done

echo
librelane --version
yosys -V
yosys -m slang -p 'help read_slang' >/dev/null
echo "Yosys Slang plugin: OK"
timeout 90 openroad -version
timeout 30 sta -version || true
timeout 60 klayout -v
timeout 30 magic --version
timeout 30 netgen -batch help | sed -n '1p'
iverilog -V 2>/dev/null | head -n 2
verilator --version
