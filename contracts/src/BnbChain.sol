// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title BnbChain
/// @notice Every external address the BNB Chain deployment stands on.
///
/// @dev The counterpart to RobinhoodChain.sol, and deliberately a separate file
///      rather than an edit of it: the Robinhood deployment is live and must
///      keep building from its own constants.
///
///      EVERY ADDRESS HERE WAS READ OFF BNB CHAIN, not copied from a listing.
///      The stock tokens were found by scanning PancakeSwap's token list by
///      company name, then confirmed with `symbol()`, `decimals()` and
///      `totalSupply()`; the pools by calling the v3 factory's `getPool` across
///      every fee tier and reading both sides' balances; the feeds from
///      Chainlink's BSC reference-data directory.
///
///      WHY THIS BASKET AND NOT THE ROBINHOOD ONE. A name is only usable if it
///      clears three gates at once: the token exists here, it has a pool with
///      real depth, and Chainlink prices it on this chain. Measured:
///
///        · NVDA, AAPL, TSLA, AMZN — Chainlink prices them on BSC, but Binance
///          never issued them as bStocks. Backed's xStocks do exist (NVDAx,
///          TSLAx) and are unusable: $16k of liquidity in one NVDAx pool and
///          three at zero, $37 and $21 for TSLAx, no AAPLx pair at all.
///        · MSTRB, INTCB, SOXLB — tradable, but Chainlink has no feed for them
///          on this chain, so the oracle cannot price the basket and the guard
///          cannot bound the keeper.
///        · AMDB, COINB, PLTRB, QCOMB, WDCB, CBRSB, GLWB, LITEB, NBISB — issued
///          and listed, zero liquidity. The AMD case from Robinhood Chain, nine
///          times over.
///
///      Five names clear all three. Two of them are index ETFs, which changes
///      what the product is and is worth saying out loud rather than burying.
library BnbChain {
    /// @dev BNB Chain mainnet. Gas is BNB, not ETH.
    uint256 internal constant CHAIN_ID = 56;

    /**
     * @dev The stablecoin deposits are taken in. EIGHTEEN decimals, not six --
     *      the opposite of USDG on Robinhood Chain, and the single likeliest
     *      source of a silent off-by-1e12 in ported code.
     *
     *      USDT and not USDC, which was asked for and measured: every bStock
     *      pool is quoted against USDT and NOT ONE has a USDC pair. Pricing the
     *      vault in USDC would turn each basket leg into USDC->USDT->stock,
     *      paying two fees and two spreads in each direction for nothing. The
     *      Venus USDC market is also a fifth the size of the USDT one.
     */
    address internal constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    uint8 internal constant USDT_DECIMALS = 18;

    /**
     * @dev Venus's core USDT market -- a Compound v2 vToken, NOT an ERC-4626.
     *      Safex needs a 4626, so VenusERC4626Wrapper sits in between.
     *
     *      Venus does ship an official 4626 factory (0xC2f7924809830886EB04c6b40725Fd68F1891fA2)
     *      and it was tried first: `createERC4626` on this market reverts with
     *      VenusERC4626Factory__InvalidVToken, because that factory only accepts
     *      vTokens registered in the isolated-pool registry. Measured, the
     *      isolated USDT pools hold four to five figures at ~3% utilisation
     *      while this one holds ~$90M of cash against ~$117M of borrows. The
     *      wrapper Venus provides is available exactly where the yield is not.
     */
    address internal constant VUSDT = 0xfD5840Cd36d94D7229439859C0112a4185BC0255;

    /* ── the basket ───────────────────────────────────────────────────── */

    /// @dev Binance bStocks. All eighteen decimals.
    address internal constant SPYB = 0x7138b48df7D98D7e3cc221BfE7192D0a178182D8;
    address internal constant QQQB = 0x205812CdBed920aFf76C6580abD681a46D11efc7;
    address internal constant GOOGLB = 0x3F53De71c126BdaBAe20f9cD64848d317f6C3238;
    address internal constant MSFTB = 0x80106cb3EAD06659A5ad19DF39D9b4733863B9b0;
    address internal constant METAB = 0x7425889FE94F9d693E8daefE88BCCed6AcFEf4c0;

    /**
     * @dev Chainlink aggregators, eight decimals, same as the Robinhood build.
     *
     *      These price the UNDERLYING share, so they are only correct for a
     *      token that tracks it one-for-one. That is why this basket is bStocks
     *      and not Ondo's Global Markets tokens: Ondo's are total-return
     *      trackers that reinvest dividends, so they drift above spot for ever.
     *      Priced against a spot feed the vault would read them as permanently
     *      cheap and the keeper would keep buying.
     */
    address internal constant SPY_USD_FEED = 0xb24D1DeE5F9a3f761D286B56d2bC44CE1D02DF7e;
    address internal constant QQQ_USD_FEED = 0x9A41B56b2c24683E2f23BdE15c14BC7c4a58c3c4;
    address internal constant GOOGL_USD_FEED = 0xeDA73F8acb669274B15A977Cb0cdA57a84F18c2a;
    address internal constant MSFT_USD_FEED = 0x5D209cE1fBABeAA8E6f9De4514A74FFB4b34560F;
    address internal constant META_USD_FEED = 0xfc76E9445952A3C31369dFd26edfdfb9713DF5Bb;

    /* ── the venue ────────────────────────────────────────────────────── */

    /**
     * @dev PancakeSwap v3, not Uniswap v4.
     *
     *      Uniswap v4's PoolManager IS deployed on BNB Chain, so the port could
     *      have been a rename -- except no bStock trades there. Every pool with
     *      depth is PancakeSwap v3, which is a Uniswap V3 fork: a pool contract
     *      per pair-and-tier, and a `swap` that calls the payer back. That is a
     *      different shape from v4's singleton-and-unlock, which is why
     *      PancakeV3Executor replaces SwapExecutor rather than subclassing it.
     */
    address internal constant PANCAKE_V3_FACTORY = 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865;

    /**
     * @dev The fee tier each name actually trades in, read off the factory.
     *
     *      NOT UNIFORM, and that is the whole point of storing it per token.
     *      The first ExitRouter on Robinhood Chain derived the tier from a
     *      constant, which held until the basket grew and then took the whole
     *      exit down with it. Here the spread is wider from day one: the two
     *      ETFs sit at 0.01% and the three single names at 0.25%.
     */
    function poolFee(address token) internal pure returns (uint24) {
        if (token == SPYB || token == QQQB) return 100;
        return 2500;
    }
}
