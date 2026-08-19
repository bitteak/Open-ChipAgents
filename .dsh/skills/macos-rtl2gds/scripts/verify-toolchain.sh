#!/usr/bin/env bash
set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_ROOT}/../../.." && pwd)"
LAB_ROOT="${REPO_ROOT}/chip-agent-lab"

"${LAB_ROOT}/bin/in-env" "${LAB_ROOT}/bin/verify-tools.sh"
"${LAB_ROOT}/bin/sim-sha256.sh"

if [[ ! -d "${LAB_ROOT}/.cache/pdks/ciel/sky130/versions" ]]; then
    echo "SKY130A PDK is not installed under ${LAB_ROOT}/.cache/pdks/ciel." >&2
    exit 1
fi

latest_run="$(find "${LAB_ROOT}/designs/smoke/runs" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort | tail -n 1)"
if [[ -z "${latest_run}" || ! -f "${latest_run}/final/metrics.json" ]]; then
    echo "No completed smoke-flow metrics found. Run bootstrap-toolchain.sh." >&2
    exit 1
fi

echo "Latest smoke metrics: ${latest_run}/final/metrics.json"
echo "Toolchain verification: PASS"
