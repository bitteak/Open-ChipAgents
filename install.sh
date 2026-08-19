#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="web"
HARNESS_ROOT="${DEEPSEEK_HARNESS_ROOT:-}"

usage() {
    echo "Usage: $0 [--profile NAME] [--harness-root PATH]" >&2
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile)
            PROFILE="${2:?missing profile name}"
            shift 2
            ;;
        --harness-root)
            HARNESS_ROOT="${2:?missing harness path}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage
            exit 2
            ;;
    esac
done

PLUGIN="${ROOT}/plugins/dsh-sky130-flow"

if command -v dsh >/dev/null 2>&1; then
    dsh plugin --profile "${PROFILE}" add "${PLUGIN}"
elif [[ -n "${HARNESS_ROOT}" && -f "${HARNESS_ROOT}/package.json" ]] && command -v pnpm >/dev/null 2>&1; then
    (
        cd "${HARNESS_ROOT}"
        pnpm dsh plugin --profile "${PROFILE}" add "${PLUGIN}"
    )
else
    echo "Cannot find dsh. Install it, or pass --harness-root /path/to/deepseek-harness with pnpm available." >&2
    exit 2
fi

echo
echo "Installed dsh-sky130-flow into profile '${PROFILE}'."
echo "Launch with: ${ROOT}/bin/dsh-open-chipagents --profile ${PROFILE}${HARNESS_ROOT:+ --harness-root ${HARNESS_ROOT}}"
