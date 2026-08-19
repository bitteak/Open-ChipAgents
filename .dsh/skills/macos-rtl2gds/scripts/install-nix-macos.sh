#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
    echo "This installer supports Apple Silicon macOS only." >&2
    exit 2
fi

NIX_BIN="/nix/var/nix/profiles/default/bin/nix"
if [[ -x "${NIX_BIN}" ]]; then
    "${NIX_BIN}" --version
    echo "Nix is already installed. No system changes were made."
    exit 0
fi

if ! xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools are required. Run: xcode-select --install" >&2
    exit 2
fi

echo "This will create the system-level /nix store and trust:"
echo "  https://nix-cache.fossi-foundation.org"
echo "The macOS administrator prompt must be answered by the user."

installer="$(mktemp -t open-chipagents-nix-installer.XXXXXX)"
trap 'rm -f "${installer}"' EXIT

curl --proto '=https' --tlsv1.2 -fsSL \
    https://artifacts.nixos.org/nix-installer \
    -o "${installer}"

extra_conf=$'extra-substituters = https://nix-cache.fossi-foundation.org\nextra-trusted-public-keys = nix-cache.fossi-foundation.org:3+K59iFwXqKsL7BNu6Guy0v+uTlwsxYQxjspXzqLYQs=\nextra-experimental-features = nix-command flakes'

sh "${installer}" install \
    --no-confirm \
    --extra-conf "${extra_conf}"

echo
echo "Nix installation completed. Open a new terminal before continuing."
