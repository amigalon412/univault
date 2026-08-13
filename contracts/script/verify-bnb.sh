#!/usr/bin/env bash
# Verify every deployed SAFEX contract on BscScan (BNB Chain, id 56).
#
# Verification uploads source; it sends no transaction and needs no private
# key. Safe to re-run -- an already-verified contract is reported as such and
# skipped.
#
# NOT the same script as verify-all.sh. That one targets Blockscout on
# Robinhood Chain, which needs no API key at all. BscScan does, and since its
# own V1 endpoint was retired the key is an ETHERSCAN one used through the V2
# multichain API with chainid=56 -- forge 1.7+ does that itself given
# --etherscan-api-key and --chain 56.
#
# Constructor arguments are READ OFF THE CHAIN rather than assumed from the
# deploy script's defaults, because DeployBnbStack takes several of them from
# `vm.envOr` and the values actually used are only recoverable from deployed
# state. The deployer and the owner are the same address, so that script's
# `transferOwnership` block never ran and every constructor's owner argument
# equals the current `owner()`.
#
# Usage:  cd contracts && bash script/verify-bnb.sh
#         cd contracts && bash script/verify-bnb.sh --dry-run
#
# Needs ETHERSCAN_API_KEY, which is read from contracts/.env (gitignored).

set -uo pipefail
cd "$(dirname "$0")/.."

RPC="https://bsc-dataseed.binance.org"
CHAIN_ID=56
SOLC="0.8.26"      # foundry.toml
RUNS=200           # foundry.toml optimizer_runs

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "ETHERSCAN_API_KEY is not set. Put it in contracts/.env:" >&2
  echo "  echo 'ETHERSCAN_API_KEY=...' >> contracts/.env" >&2
  exit 2
fi

# ── the deployment, from contracts/DEPLOYMENTS.md ──────────────────────────
OWNER=0x13fB1e4C02bEC80377d17c2D187f85b27DD90222
USDT=0x55d398326f99059fF775485246999027B3197955
VUSDT=0xfD5840Cd36d94D7229439859C0112a4185BC0255
FACTORY=0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865
LENDING=0xf9ABEa4Bf8FeBEDB9FEd8eCF7a7F1272C49f5424

V_STEADY=0x8F6154E79471CE8538f0DCEb9D0cf90d48D883E6
V_BALANCED=0x0c892E668a20a4fE82d7963580ebD0C6A66Ba8F4
V_GROWTH=0x12a2DC45Cd51F26075129332ceD4bC6e1e190ae5

O_STEADY=0x624f480665aA4eF84f15a53cc76ce9a9F07735cf
O_BALANCED=0xf1C6503a26fB311281E7C588999E837d2Aac4362
O_GROWTH=0xA6888102e9e13613db8cB747d52F301059b86Dd9

G_STEADY=0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A
G_BALANCED=0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE
G_GROWTH=0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B

B_BALANCED=0x0C55a91caBDbD63000983286dd78ABC889a513BE
B_GROWTH=0xEb25dE433C682D26b29EA7b9d543cDd935bE6090

ok=0; fail=0

# verify <address> <src:Contract> <abi-encoded-ctor-args-or-empty> <label>
verify() {
  local addr="$1" what="$2" args="$3" label="$4"
  echo
  echo "── $label  $addr"
  local cmd=(forge verify-contract "$addr" "$what"
    --chain "$CHAIN_ID"
    --compiler-version "$SOLC"
    --num-of-optimizations "$RUNS"
    --etherscan-api-key "$ETHERSCAN_API_KEY"
    --watch)
  [ -n "$args" ] && cmd+=(--constructor-args "$args")

  if [ "$DRY" = 1 ]; then
    # The key is the one thing that must not end up in a terminal scrollback.
    printf '   would run: %s\n' "${cmd[*]/$ETHERSCAN_API_KEY/\$ETHERSCAN_API_KEY}"
    return
  fi

  if "${cmd[@]}"; then ok=$((ok+1)); else fail=$((fail+1)); fi
}

enc() { cast abi-encode "$@"; }

# ── the lending wrapper, shared by all three vaults ────────────────────────
verify "$LENDING" src/VenusERC4626Wrapper.sol:VenusERC4626Wrapper \
  "$(enc 'c(address,address,string,string)' "$USDT" "$VUSDT" 'Safex USDT (Venus)' 'sfxUSDT')" \
  "VenusERC4626Wrapper"

# ── vaults ─────────────────────────────────────────────────────────────────
verify "$V_STEADY" src/Safex.sol:Safex \
  "$(enc 'c(address,address,string,string,address)' "$USDT" "$LENDING" 'Safex Steady' 'sfxSTEADY' "$OWNER")" \
  "Safex STEADY"
verify "$V_BALANCED" src/Safex.sol:Safex \
  "$(enc 'c(address,address,string,string,address)' "$USDT" "$LENDING" 'Safex Balanced' 'sfxBALANCED' "$OWNER")" \
  "Safex BALANCED"
verify "$V_GROWTH" src/Safex.sol:Safex \
  "$(enc 'c(address,address,string,string,address)' "$USDT" "$LENDING" 'Safex Growth' 'sfxGROWTH' "$OWNER")" \
  "Safex GROWTH"

# ── guards. 50,000 USDT at EIGHTEEN decimals, 1h cooldown ──────────────────
GUARD_ARGS="$(enc 'c(address,uint256,uint32)' "$OWNER" 50000000000000000000000 3600)"
verify "$G_STEADY"   src/KeeperGuard.sol:KeeperGuard "$GUARD_ARGS" "KeeperGuard STEADY"
verify "$G_BALANCED" src/KeeperGuard.sol:KeeperGuard "$GUARD_ARGS" "KeeperGuard BALANCED"
verify "$G_GROWTH"   src/KeeperGuard.sol:KeeperGuard "$GUARD_ARGS" "KeeperGuard GROWTH"

# ── oracles ────────────────────────────────────────────────────────────────
ORACLE_ARGS="$(enc 'c(address)' "$OWNER")"
verify "$O_STEADY"   src/PriceOracle.sol:PriceOracle "$ORACLE_ARGS" "PriceOracle STEADY"
verify "$O_BALANCED" src/PriceOracle.sol:PriceOracle "$ORACLE_ARGS" "PriceOracle BALANCED"
verify "$O_GROWTH"   src/PriceOracle.sol:PriceOracle "$ORACLE_ARGS" "PriceOracle GROWTH"

# ── basket adapters. STEADY has none by design: it is 100% stable ──────────
verify "$B_BALANCED" src/BnbBasketAdapter.sol:BnbBasketAdapter \
  "$(enc 'c(address,address,address,address,address)' "$OWNER" "$O_BALANCED" "$V_BALANCED" "$USDT" "$FACTORY")" \
  "BnbBasketAdapter BALANCED"
verify "$B_GROWTH" src/BnbBasketAdapter.sol:BnbBasketAdapter \
  "$(enc 'c(address,address,address,address,address)' "$OWNER" "$O_GROWTH" "$V_GROWTH" "$USDT" "$FACTORY")" \
  "BnbBasketAdapter GROWTH"

# ── the exit router, once it exists ────────────────────────────────────────
if [ -n "${EXIT_ROUTER:-}" ]; then
  verify "$EXIT_ROUTER" src/BnbExitRouter.sol:BnbExitRouter \
    "$(enc 'c(address)' "$FACTORY")" "BnbExitRouter"
else
  echo
  echo "── BnbExitRouter: not deployed yet, skipping."
  echo "   After DeployBnbExitRouter lands: EXIT_ROUTER=0x... bash script/verify-bnb.sh"
fi

echo
echo "══════════════════════════════════════"
[ "$DRY" = 1 ] && { echo "dry run, nothing sent"; exit 0; }
echo "verified: $ok   failed: $fail"
[ "$fail" -gt 0 ] && exit 1
exit 0
