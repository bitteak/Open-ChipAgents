#!/usr/bin/env bash
set -euo pipefail

LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${IN_NIX_SHELL:-}" ]]; then
    exec "${LAB_ROOT}/bin/in-env" "$0" "$@"
fi

design="${1:-smoke}"
pdk="${2:-sky130A}"
tag="${3:-${pdk}-$(date +%Y%m%d-%H%M%S)}"
config="${LAB_ROOT}/designs/${design}/config.yaml"
pdk_root="${PDK_ROOT:-${LAB_ROOT}/.cache/pdks}"

case "${pdk}" in
    sky130A|gf180mcuD) ;;
    *)
        echo "Unsupported PDK '${pdk}'. Choose sky130A or gf180mcuD." >&2
        exit 2
        ;;
esac

if [[ ! -f "${config}" ]]; then
    echo "Unknown design '${design}': ${config} not found." >&2
    exit 2
fi

mkdir -p "${pdk_root}"
librelane \
    --pdk-root "${pdk_root}" \
    --pdk "${pdk}" \
    --run-tag "${tag}" \
    "${config}"
