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
#   export KEEPER_PRIVATE_KEY=0x...    # a key registered via setKeeper, NOT the
#                                      # owner key — see VPS.md
#   export DRY_RUN=false
#   bash run-all.sh
#
# Ctrl-C stops all three. Addresses are the mainnet deploys in
# contracts/DEPLOYMENTS.md.
set -uo pipefail
cd "$(dirname "$0")"

# name : vault : guard  (Robinhood Chain mainnet)
# Live allocate-on-deposit vaults, redeployed 2026-07-25. See
# contracts/DEPLOYMENTS.md — the pre-redeploy vaults are superseded and MUST NOT
# be driven here.
PAIRS=(
  "STEADY:0x583bce228448814bc42235d4761290f3ac710a09:0xedc4d302ab6c87f77ed084462dc82530e460da11"
  "BALANCED:0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7:0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613"
  "GROWTH:0xd9a66ef89fe6b2a129b6b78f953d2a89bb7ce04c:0xFa71F59495e8c5E4d935b0dC76c327f9eCEf123A"
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
