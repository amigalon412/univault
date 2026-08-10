#!/usr/bin/env bash
# Verify every deployed BLUR contract on Blockscout.
#
# Verification uploads source; it sends no transaction and needs no private
# key. Safe to re-run -- an already-verified contract is reported as such and
# skipped by the explorer.
#
# Constructor arguments are read off the chain rather than assumed from the
# deploy script's env defaults, because the script takes several of them from
# `vm.envOr` and the values actually used are only recoverable from the
# deployed state. The deployer and the owner are the same address, so
# DeployStack's `transferOwnership` block never ran and each constructor's
# owner argument equals the current `owner()`.
#
# The guards are the one exception to "build from HEAD". They were deployed
# before 423d0b9 lowered MAX_SLIPPAGE_BPS, so a HEAD build misses their
# bytecode by one word and the explorer rejects it. They are already verified;
# should that ever need redoing, swap the file first and put it back after:
#
#   git show 423d0b9^:contracts/src/KeeperGuard.sol > contracts/src/KeeperGuard.sol
#   forge build && bash script/verify-all.sh
#   git checkout contracts/src/KeeperGuard.sol && forge build
#
# Usage:  cd contracts && bash script/verify-all.sh
#         cd contracts && bash script/verify-all.sh --dry-run

set -uo pipefail

RPC="https://rpc.mainnet.chain.robinhood.com"
EXPLORER="https://robinhoodchain.blockscout.com"
CHAIN_ID=4663
SOLC="0.8.26"      # foundry.toml
RUNS=200           # foundry.toml optimizer_runs

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

# Shared, and identical across all three stacks.
POOL_MANAGER=0x8366a39CC670B4001A1121B8F6A443A643e40951

# strategy : vault : guard : oracle : basket ("-" when the vault has none)
STACKS=(
  "STEADY:0x583bce228448814bc42235d4761290f3ac710a09:0xedc4d302ab6c87f77ed084462dc82530e460da11:0x42fd413f655b9b66cef3fd5a3de469e5800a8fed:-"
  "BALANCED:0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7:0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613:0x932aa45036045540dbfab7252bd3398f35f32e76:0x8449202B6525F9632eB25809B91B50c1820fAAE4"
  "GROWTH:0xd9a66ef89fe6b2a129b6b78f953d2a89bb7ce04c:0xFa71F59495e8c5E4d935b0dC76c327f9eCEf123A:0x73723a588c1f6696b13fd1d0d4b86794f641b4da:0x15AD8f555e1f9Ac05115f88C25cFF76B8121720A"
)

EXIT_ROUTER=0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0

call() { cast call "$1" "$2" --rpc-url "$RPC" 2>/dev/null; }
unquote() { sed 's/^"//; s/"$//'; }

# Blockscout rate-limits, and it does so by returning an HTML error page or
# "Too many requests" rather than anything forge recognises -- which reads as a
# verification failure when it is nothing of the sort. Six of thirteen failed
# that way on the first run and verified on a slower one.
THROTTLE="${THROTTLE:-12}"

verify() { # address  path:Name  encoded-args
  local addr="$1" target="$2" args="$3"
  if [ "$DRY" = "1" ]; then
    printf '  %-46s %s\n' "$target" "$addr"
    printf '    args %s\n' "${args:0:74}…"
    return
  fi
  forge verify-contract "$addr" "$target" \
    --verifier blockscout \
    --verifier-url "$EXPLORER/api" \
    --chain-id "$CHAIN_ID" \
    --compiler-version "$SOLC" \
    --num-of-optimizations "$RUNS" \
    --constructor-args "$args" \
    || echo "  !! failed: $target $addr"
  sleep "$THROTTLE"
}

for row in "${STACKS[@]}"; do
  IFS=: read -r NAME VAULT GUARD ORACLE BASKET <<<"$row"
  echo "== $NAME =="

  asset=$(call "$VAULT" 'asset()(address)')
  yv=$(call "$VAULT" 'yieldVault()(address)')
  vname=$(call "$VAULT" 'name()(string)' | unquote)
  vsym=$(call "$VAULT" 'symbol()(string)' | unquote)
  vowner=$(call "$VAULT" 'owner()(address)')
  verify "$VAULT" src/Univault.sol:Univault \
    "$(cast abi-encode 'c(address,address,string,string,address)' "$asset" "$yv" "$vname" "$vsym" "$vowner")"

  gowner=$(call "$GUARD" 'owner()(address)')
  gmax=$(call "$GUARD" 'maxDeployPerCall()(uint256)' | awk '{print $1}')
  gcd=$(call "$GUARD" 'cooldown()(uint32)' | awk '{print $1}')
  verify "$GUARD" src/KeeperGuard.sol:KeeperGuard \
    "$(cast abi-encode 'c(address,uint256,uint32)' "$gowner" "$gmax" "$gcd")"

  oowner=$(call "$ORACLE" 'owner()(address)')
  verify "$ORACLE" src/PriceOracle.sol:PriceOracle \
    "$(cast abi-encode 'c(address)' "$oowner")"

  # STEADY is entirely stable, so it has nothing to price and no adapter.
  if [ "$BASKET" != "-" ]; then
    bowner=$(call "$BASKET" 'owner()(address)')
    boracle=$(call "$BASKET" 'oracle()(address)')
    bvault=$(call "$BASKET" 'vault()(address)')
    bstable=$(call "$BASKET" 'stable()(address)')
    verify "$BASKET" src/BasketAdapter.sol:BasketAdapter \
      "$(cast abi-encode 'c(address,address,address,address,address)' "$bowner" "$boracle" "$bvault" "$bstable" "$POOL_MANAGER")"
  fi
done

echo "== PERIPHERY =="
verify "$EXIT_ROUTER" src/ExitRouter.sol:ExitRouter \
  "$(cast abi-encode 'c(address)' "$POOL_MANAGER")"

echo
echo "== RESULT =="
for row in "${STACKS[@]}"; do
  IFS=: read -r NAME VAULT GUARD ORACLE BASKET <<<"$row"
  for a in "$VAULT" "$GUARD" "$ORACLE" "$BASKET"; do
    [ "$a" = "-" ] && continue
    v=$(curl -s -m 20 "$EXPLORER/api/v2/addresses/$a" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('is_verified'))" 2>/dev/null)
    printf '  %-8s %s  verified=%s\n' "$NAME" "$a" "$v"
  done
done
v=$(curl -s -m 20 "$EXPLORER/api/v2/addresses/$EXIT_ROUTER" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('is_verified'))" 2>/dev/null)
printf '  %-8s %s  verified=%s\n' "ROUTER" "$EXIT_ROUTER" "$v"
