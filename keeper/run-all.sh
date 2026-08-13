#!/usr/bin/env bash
#
# Runs the SAFEX keeper against all three deployed vaults at once, so earning is
# "connected" with a single command instead of three terminals.
#
# The keeper itself drives one vault per process (every on-chain limit is
# enforced by that vault's KeeperGuard, not here); this just launches one per
# vault and forwards their logs, prefixed by strategy.
#
# Dry run by default — reads the chain, decides, sends nothing. To go live:
#
#   cd keeper
#   export KEEPER_PRIVATE_KEY=0x...    # a key registered via setKeeper, NOT the
#                                      # owner key — see VPS.md
#   export DRY_RUN=false
#   bash run-all.sh
#
# Ctrl-C stops all three. Addresses are the mainnet deploys in
# contracts/DEPLOYMENTS.md.
set -uo pipefail
cd "$(dirname "$0")"

# name : vault : guard  (BNB Chain mainnet, chain id 56)
# Deployed 2026-08-13. See contracts/DEPLOYMENTS.md, BNB Chain section.
#
# THESE ARE NOT THE ROBINHOOD ADDRESSES. That stack is still on chain and still
# driveable, and pointing this keeper at it while the site talks to BNB is the
# quiet way to end up rebalancing a vault nobody is using. If you need the old
# ones, they are in the same file under "Robinhood Chain (previous)".
PAIRS=(
  "STEADY:0x8F6154E79471CE8538f0DCEb9D0cf90d48D883E6:0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A"
  "BALANCED:0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4:0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE"
  "GROWTH:0x12a2DC45Cd51F26075129332ceD4bC6e1e190ae5:0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B"
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
