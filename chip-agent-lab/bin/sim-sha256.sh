#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "${LAB_ROOT}/.." && pwd)"

if [[ -z "${IN_NIX_SHELL:-}" ]]; then
    exec "${LAB_ROOT}/bin/in-env" "$0" "$@"
fi

RTL_DIR="${WORKSPACE_ROOT}/references/CDragon-SHA-256/Verilog"
TB="${WORKSPACE_ROOT}/references/CDragon-SHA-256/flow/fips_180_4_post_sim_tb.v"
OUT_DIR="${LAB_ROOT}/runs/sha256-rtl-sim"

if [[ ! -f "${RTL_DIR}/SHA256.v" || ! -f "${TB}" ]]; then
    echo "SHA-256 teaching RTL is missing. Run bootstrap-toolchain.sh first." >&2
    exit 2
fi

mkdir -p "${OUT_DIR}"
cd "${OUT_DIR}"

iverilog -g2012 -Wall -I "${RTL_DIR}" \
    -s fips_180_4_post_sim_tb \
    -o sha256-fips.vvp \
    "${TB}" "${RTL_DIR}/SHA256.v"

vvp sha256-fips.vvp | tee simulation.log
grep -q "ALL FIPS 180-4 TESTS PASSED" simulation.log
echo "SHA-256 RTL simulation: PASS"
