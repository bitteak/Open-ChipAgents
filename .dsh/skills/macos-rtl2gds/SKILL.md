---
name: macos-rtl2gds
description: Deploy, verify, or diagnose the native open-source RTL-to-GDS toolchain on an Apple Silicon Mac using Nix, LibreLane, SKY130A, and optional GF180MCU-D. Use for first-time EDA setup, PDK installation, binary-path checks, smoke GDS generation, or explaining the RTL-to-GDS stages and their open-source tools.
---

# macOS RTL to GDS

Build the pinned teaching environment in this repository. Keep installation,
verification, and interpretation separate so failures remain attributable.

## Safety gate

Before running `scripts/install-nix-macos.sh`, tell the user that it creates the
system-level `/nix` store and trusts the FOSSi Foundation binary cache. Obtain
explicit approval. Never request, receive, store, or type the user's password;
the user must answer any macOS administrator prompt directly.

PDK downloads require about 2.1 GiB for SKY130A and another 3.8 GiB for
GF180MCU-D. Check available disk space before downloading. Do not delete an
existing PDK or Nix store to make space without a separate explicit request.

## Workflow

1. Confirm `uname -s` is `Darwin` and `uname -m` is `arm64`.
2. Confirm Xcode Command Line Tools with `xcode-select -p`. If absent, ask the
   user to run `xcode-select --install` and wait for completion.
3. Read `references/toolchain.md` when explaining components, revisions, disk
   use, or pass criteria.
4. If `/nix/var/nix/profiles/default/bin/nix` is absent, apply the safety gate
   and run `scripts/install-nix-macos.sh`. Ask the user to open a new terminal
   if the installer requests it.
5. Run `scripts/bootstrap-toolchain.sh` for the default SKY130A setup. Use
   `--pdks all` only when the user requests GF180 as well and accepts its disk
   and download cost.
6. Run `scripts/verify-toolchain.sh`. Report exact missing tools or failing
   stages; do not collapse a partial result into a generic failure.

## Result standard

Treat the smoke design as an environment acceptance test, not product signoff.
A successful run demonstrates that synthesis, floorplanning, placement, CTS,
routing, extraction, timing analysis, GDS generation, DRC, and LVS can execute
with the selected PDK. It does not validate a user's RTL, constraints, power
delivery, package assumptions, or tape-out readiness.

Report the PDK location and generated run directory without exposing unrelated
home-directory paths. Distinguish tool installation success from physical-flow
success.

## Boundaries

- Keep LibreLane and reference RTL at the commits in
  `../../../chip-agent-lab/manifests/toolchain.lock.json`.
- Use the Nix environment; do not substitute Homebrew binaries into the pinned
  flow silently.
- Do not claim native support for Intel-only binaries. This environment is
  verified for `aarch64-darwin` without Rosetta or a Linux VM.
- Do not call a DRC-clean result timing-clean. Read timing metrics separately.
