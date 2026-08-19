#!/usr/bin/env bash
set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_ROOT}/../../.." && pwd)"
LAB_ROOT="${REPO_ROOT}/chip-agent-lab"
fail=0

check_file() {
    if [[ -e "$1" ]]; then
        printf 'OK      %s\n' "$1"
    else
        printf 'MISSING %s\n' "$1"
        fail=1
    fi
}

check_file "${REPO_ROOT}/plugins/dsh-sky130-flow/package.json"
check_file "${LAB_ROOT}/bin/in-env"
check_file "${LAB_ROOT}/bin/sim-sha256.sh"
check_file "${LAB_ROOT}/designs/sha256/config.yaml"
check_file "${REPO_ROOT}/references/CDragon-SHA-256/Verilog/SHA256.v"
check_file "${LAB_ROOT}/.cache/pdks/ciel/sky130/versions"

if [[ ${fail} -ne 0 ]]; then
    echo "Run the macos-rtl2gds setup before invoking the physical-flow tool." >&2
    exit 1
fi

echo "SKY130 SHA-256 lab preflight: PASS"
