// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PriceOracle} from "./PriceOracle.sol";
import {PancakeV3Executor, IPancakeV3Factory} from "./PancakeV3Executor.sol";
import {BasketAdapterCore} from "./BasketAdapterCore.sol";

/// @title BnbBasketAdapter
/// @notice The PancakeSwap v3 basket adapter. For BNB Chain.
///
/// @dev The sibling of BasketAdapter. Same core, different venue: PancakeSwap
///      v3 has a pool contract per pair-and-tier, so a route is fully described
///      by one number -- the fee tier -- against the vault's own stable. There
///      is no PoolKey to store and no currency ordering to get wrong, because
///      the pool address is derived by the factory, not by this contract.
///
///      THE TIER IS PER TOKEN AND THAT IS THE POINT. The first ExitRouter on
///      Robinhood Chain built every route from one hard-coded 0.30% tier. It
///      was right for the four names the basket launched with, and wrong the
///      day it grew: the new names traded at 1%, their 0.30% pools were empty,
///      the swap reverted and took the whole exit with it. On BNB the spread is
///      there from the start -- the index ETFs sit at 0.01% and the single
///      names at 0.25% -- so a uniform tier would not have survived the first
///      deposit.
contract BnbBasketAdapter is BasketAdapterCore, PancakeV3Executor {
    /// @notice The fee tier each constituent trades in, fixed by the owner.
    /// @dev Zero means unset. Routing is configuration, not an argument: if a
    ///      caller could name the tier it could point a trade at a pool it had
    ///      just created and priced to its liking.
    mapping(address token => uint24 fee) public poolFees;

    event PoolFeeSet(address indexed token, uint24 fee, address pool);

    constructor(
        address owner_,
        PriceOracle oracle_,
        address vault_,
        address stable_,
        IPancakeV3Factory factory_
    ) BasketAdapterCore(owner_, oracle_, vault_, stable_) PancakeV3Executor(factory_) {}

    function _swapVia(address token, address inputToken, uint256 amountIn, uint256 minOut)
        internal
        override
        returns (uint256)
    {
        uint24 fee = poolFees[token];
        if (fee == 0) revert NoPool(token);

        /* `inputToken` is the stable on a buy and the token itself on a sell,
           so the output side is simply the other one. */
        address tokenOut = inputToken == token ? stable : token;
        return _executeSwap(
            SwapRequest({
                tokenIn: inputToken,
                tokenOut: tokenOut,
                fee: fee,
                amountIn: amountIn,
                minAmountOut: minOut
            })
        );
    }

    /**
     * @notice Fix the tier this token trades in.
     *
     * @dev Stricter than its Uniswap v4 counterpart, and cheaply so. There,
     *      `setPool` could only check that the key named the right pair -- a
     *      key for a pool that had never been initialised looked identical to a
     *      good one, and the mistake surfaced as a failed swap later. Here the
     *      factory can be asked outright whether the pool exists, so a tier
     *      that names nothing is rejected at configuration time, by the person
     *      who can still fix it.
     *
     *      What this still cannot check is depth. A pool can exist and hold
     *      nothing; that is what the fork test's per-name depth assertion is
     *      for.
     */
    function setPoolFee(address token, uint24 fee) external onlyOwner {
        if (!constituents[token].set) revert UnknownToken(token);
        if (fee == 0) revert NoPool(token);

        address pool = factory.getPool(token, stable, fee);
        if (pool == address(0)) revert NoPool(token);

        poolFees[token] = fee;
        emit PoolFeeSet(token, fee, pool);
    }
}
