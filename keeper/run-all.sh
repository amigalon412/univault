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
  "STEADY:0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37:0x101183e175EA27E059Fd44E6B36e5fBF1f466F26"
  "BALANCED:0x3601c09C4F84885454cCbd46B9dF3DaB244c1150:0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7"
  "GROWTH:0xa809DC62C6fc723E04B061cbE6271AaA093eC75b:0x56CAceC02cc8DCb729b209cA1b8EdF5609da091B"
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
