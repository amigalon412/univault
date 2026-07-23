#!/usr/bin/env bash
#
# Runs the BLUR keeper against all three deployed vaults at once, so earning is
# "connected" with a single command instead of three terminals.
#
# The keeper itself drives one vault per process (every on-chain limit is
# enforced by that vault's KeeperGuard, not here); this just launches one per
# vault and forwards their logs, prefixed by strategy.
#
# Dry run by default — reads the chain, decides, sends nothing. To go live:
#
#   cd keeper
#   export KEEPER_PRIVATE_KEY=0x...    # the keeper key (owner = keeper here)
#   export DRY_RUN=false
#   bash run-all.sh
#
# Ctrl-C stops all three. Addresses are the mainnet deploys in
# contracts/DEPLOYMENTS.md.
set -uo pipefail
cd "$(dirname "$0")"

# name : vault : guard  (Robinhood Chain mainnet)
PAIRS=(
  "STEADY:0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996:0x7f51f8b63376c2c744f3ec11834db14149ac8b1b"
  "BALANCED:0x066d4661A5419A68b64a0dCF51f5c295185dB175:0x706ABbA724aFB0A4580D8CDC670A00FE2096Dfd9"
  "GROWTH:0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787:0xd95480270452b6a53a6613ee368A918060404839"
)

pids=()
cleanup() {
  echo
  echo "stopping keepers..."
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup INT TERM EXIT

for entry in "${PAIRS[@]}"; do
  IFS=: read -r name vault guard <<< "$entry"
  VAULT_ADDRESS="$vault" GUARD_ADDRESS="$guard" \
    node src/index.js "$@" 2>&1 | sed "s/^/[$name] /" &
  pids+=($!)
done

wait
