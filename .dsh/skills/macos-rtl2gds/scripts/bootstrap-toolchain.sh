#!/usr/bin/env bash
set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "${SKILL_ROOT}/../../.." && pwd)"
LOCK_FILE="${REPO_ROOT}/chip-agent-lab/manifests/toolchain.lock.json"
NIX_BIN="${NIX_BIN:-/nix/var/nix/profiles/default/bin/nix}"
PDKS="sky130A"

usage() {
    echo "Usage: $0 [--pdks sky130A|gf180mcuD|all]" >&2
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --pdks)
            PDKS="${2:?missing PDK selection}"
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

case "${PDKS}" in
    sky130A|gf180mcuD|all) ;;
    *)
        usage
        exit 2
        ;;
esac

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
    echo "This bootstrap supports Apple Silicon macOS only." >&2
    exit 2
fi

if [[ ! -x "${NIX_BIN}" ]]; then
    echo "Nix is missing. Run install-nix-macos.sh first." >&2
    exit 2
fi

if ! xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools are required. Run: xcode-select --install" >&2
    exit 2
fi

if [[ ! -f "${LOCK_FILE}" ]]; then
    echo "Toolchain lock file is missing: ${LOCK_FILE}" >&2
    exit 2
fi

read_lock() {
    /usr/bin/python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]][sys.argv[3]])' \
        "${LOCK_FILE}" "$1" "$2"
}

clone_at_commit() {
    local url="$1"
    local commit="$2"
    local destination="$3"

    if [[ -d "${destination}/.git" ]]; then
        local current
        current="$(git -C "${destination}" rev-parse HEAD)"
        if [[ "${current}" != "${commit}" ]]; then
            echo "Existing checkout has unexpected commit: ${destination}" >&2
            echo "expected ${commit}, found ${current}" >&2
            exit 2
        fi
        return
    fi

    if [[ -e "${destination}" ]]; then
        echo "Refusing to replace non-Git path: ${destination}" >&2
        exit 2
    fi

    mkdir -p "$(dirname "${destination}")"
    git clone --filter=blob:none --no-checkout "${url}" "${destination}"
    git -C "${destination}" checkout --detach "${commit}"
}

LIBRELANE_URL="$(read_lock librelane source)"
LIBRELANE_COMMIT="$(read_lock librelane commit)"
SHA_URL="$(read_lock sha256_reference source)"
SHA_COMMIT="$(read_lock sha256_reference commit)"

clone_at_commit "${LIBRELANE_URL}" "${LIBRELANE_COMMIT}" "${REPO_ROOT}/toolchains/librelane"

SHA_ROOT="${REPO_ROOT}/references/CDragon-SHA-256"
if [[ ! -d "${SHA_ROOT}/.git" ]]; then
    mkdir -p "$(dirname "${SHA_ROOT}")"
    git clone --filter=blob:none --no-checkout "${SHA_URL}" "${SHA_ROOT}"
    git -C "${SHA_ROOT}" sparse-checkout init --no-cone
    git -C "${SHA_ROOT}" sparse-checkout set \
        '/Verilog/' \
        '/flow/fips_180_4_post_sim_tb.v' \
        '/LICENSE' \
        '/LICENSE-CDragon' \
        '/NOTICE'
    git -C "${SHA_ROOT}" checkout --detach "${SHA_COMMIT}"
else
    current="$(git -C "${SHA_ROOT}" rev-parse HEAD)"
    if [[ "${current}" != "${SHA_COMMIT}" ]]; then
        echo "Existing SHA-256 checkout has unexpected commit: ${current}" >&2
        exit 2
    fi
fi

"${REPO_ROOT}/chip-agent-lab/bin/in-env" "${REPO_ROOT}/chip-agent-lab/bin/verify-tools.sh"
"${REPO_ROOT}/chip-agent-lab/bin/sim-sha256.sh"

run_smoke() {
    local pdk="$1"
    local tag="bootstrap-${pdk}-$(date -u +%Y%m%dT%H%M%SZ)"
    "${REPO_ROOT}/chip-agent-lab/bin/run-flow.sh" smoke "${pdk}" "${tag}"
    echo "Smoke run: ${REPO_ROOT}/chip-agent-lab/designs/smoke/runs/${tag}"
}

case "${PDKS}" in
    sky130A) run_smoke sky130A ;;
    gf180mcuD) run_smoke gf180mcuD ;;
    all)
        run_smoke sky130A
        run_smoke gf180mcuD
        ;;
esac

echo
echo "Open ChipAgents toolchain bootstrap completed."
echo "PDK cache: ${REPO_ROOT}/chip-agent-lab/.cache/pdks/ciel"
