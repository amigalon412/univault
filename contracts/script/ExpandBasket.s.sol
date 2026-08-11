// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";

import {BasketAdapter} from "../src/BasketAdapter.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {RobinhoodChain} from "../src/RobinhoodChain.sol";

/// @notice Adds GOOGL, MSFT, SPCX and PLTR to a vault's basket.
///
/// @dev Sixteen owner calls per vault, in one transaction batch instead of
///      sixteen clicks in an explorer. Run it once per vault.
///
///      **The order inside `run` is not cosmetic:**
///
///      1. Feeds first. A constituent whose price is not registered makes
///         every valuation revert, and deposits go with it.
///      2. Then the existing weights down. The four current names sit at
///         2500 bps each, which is exactly the 10000 ceiling
///         `_requireWeightsSane` enforces, so `addConstituent` reverts with
///         `WeightsExceedTotal` until they come down. Eight at 1250 lands
///         back on 10000 exactly.
///      3. Then the constituents.
///      4. Pools last, and it has to be last: `setPool` opens with
///         `if (!constituents[token].set) revert UnknownToken(token)`, so a
///         pool cannot be registered for a name the basket does not hold yet.
///         Written the intuitive way round — wire the market, then add the
///         holding — the whole run reverts on the first `setPool`.
///
///      Idempotent by construction: every step is checked against current
///      state first, so a run that dies halfway can be repeated without
///      reverting on the part that already landed.
contract ExpandBasket is Script {
    /// 8 names x 1250 bps = 10000, the contract's ceiling.
    uint16 internal constant W = 1250;

    /// 72 hours — the value already registered on all four existing feeds.
    /// These are equity feeds and they stop updating when the market closes,
    /// so a maxAge that does not span a weekend halts valuation every Saturday.
    uint32 internal constant MAX_AGE = 259_200;

    /// Robinhood Chain tokens and Chainlink proxies for the four new names.
    /// The feeds were found by reading `description()` off every
    /// EACAggregatorProxy on the chain; note the naming is inconsistent —
    /// most read "Robinhood X / USD" and Microsoft's reads "RHMSFT / USD".
    address internal constant GOOGL = 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3;
    address internal constant MSFT = 0xe93237C50D904957Cf27E7B1133b510C669c2e74;
    address internal constant SPCX = 0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa;
    address internal constant PLTR = 0x894E1EC2D74FFE5AEF8Dc8A9e84686acCB964F2A;

    address internal constant GOOGL_FEED = 0xA04EE5c4c8827F17e82f93bE9e19DeA221A749a8;
    address internal constant MSFT_FEED = 0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E;
    address internal constant SPCX_FEED = 0x42a95341ff361e81fd934F39943c5C98F6991844;
    address internal constant PLTR_FEED = 0x820ABedFF239034956B7A9d2F0a331f9F075eB4c;

    /// @dev SPCX and PLTR trade at 1%, not the 0.30% the original four use:
    ///      their USDG pools at 0.30% are uninitialised, and the liquidity is
    ///      all in the 1% pools. Reading the wrong tier here would set a key
    ///      that passes `setPool`'s pair check and then addresses nothing.
    uint24 internal constant FEE_30 = 3000;
    int24 internal constant TS_30 = 60;
    uint24 internal constant FEE_100 = 10000;
    int24 internal constant TS_100 = 200;

    function run() external {
        address oracleAddr = vm.envAddress("ORACLE");
        address basketAddr = vm.envAddress("BASKET");

        PriceOracle oracle = PriceOracle(oracleAddr);
        BasketAdapter basket = BasketAdapter(basketAddr);

        /* No key is read here on purpose. `startBroadcast` with no argument
           takes the signer from the command line, so this runs against
           --sender for a dry run, --private-key for a real one, or --ledger
           without a key existing on the machine at all. The older scripts in
           this folder read DEPLOYER_PK out of the environment, which is one
           more place a key has to sit. */
        vm.startBroadcast();

        // 1 — prices
        _feed(oracle, GOOGL, GOOGL_FEED);
        _feed(oracle, MSFT, MSFT_FEED);
        _feed(oracle, SPCX, SPCX_FEED);
        _feed(oracle, PLTR, PLTR_FEED);

        // 2 — make room
        _weight(basket, RobinhoodChain.NVDA);
        _weight(basket, RobinhoodChain.AAPL);
        _weight(basket, RobinhoodChain.TSLA);
        _weight(basket, RobinhoodChain.AMZN);

        // 3 — constituents
        _add(basket, GOOGL);
        _add(basket, MSFT);
        _add(basket, SPCX);
        _add(basket, PLTR);

        // 4 — pools
        _pool(basket, GOOGL, FEE_30, TS_30);
        _pool(basket, MSFT, FEE_30, TS_30);
        _pool(basket, SPCX, FEE_100, TS_100);
        _pool(basket, PLTR, FEE_100, TS_100);

        vm.stopBroadcast();

        console2.log("constituents now:", basket.tokensLength());
    }

    function _feed(PriceOracle oracle, address token, address agg) internal {
        (, , , bool set) = oracle.feeds(token);
        if (set) {
            console2.log("feed already set, skipping");
            return;
        }
        oracle.setFeed(token, agg, MAX_AGE);
    }

    function _weight(BasketAdapter basket, address token) internal {
        (uint16 current, , , bool set) = basket.constituents(token);
        if (!set || current == W) return;
        basket.setWeight(token, W);
    }

    /// @dev v4 orders a key by address, and these four do not all sort the
    ///      same way round — USDG leads for MSFT and PLTR, the token leads for
    ///      GOOGL and SPCX. Sorting here rather than writing the pairs out by
    ///      hand is the whole point: `setPool` only checks that the pair
    ///      mentions the token, so a swapped order passes and then points at a
    ///      pool id that was never initialised.
    function _pool(BasketAdapter basket, address token, uint24 fee, int24 tickSpacing) internal {
        address stable = RobinhoodChain.USDG;
        (address c0, address c1) = stable < token ? (stable, token) : (token, stable);
        basket.setPool(
            token,
            PoolKey({
                currency0: Currency.wrap(c0),
                currency1: Currency.wrap(c1),
                fee: fee,
                tickSpacing: tickSpacing,
                hooks: IHooks(address(0))
            })
        );
    }

    function _add(BasketAdapter basket, address token) internal {
        (, , , bool set) = basket.constituents(token);
        if (set) {
            console2.log("constituent already added, skipping");
            return;
        }
        basket.addConstituent(token, W);
    }
}
