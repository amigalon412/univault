// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapExecutor} from "./SwapExecutor.sol";
import {ExitRouterCore} from "./ExitRouterCore.sol";

interface IExitBasket {
    /// @dev The adapter's public `poolKeys` mapping, whose auto-getter returns
    ///      the PoolKey struct flattened into its five members.
    function poolKeys(address token)
        external
        view
        returns (Currency currency0, Currency currency1, uint24 fee, int24 tickSpacing, IHooks hooks);
}

/// @title ExitRouter
/// @notice The Uniswap v4 exit router. Live on Robinhood Chain.
///
/// @dev Sells each leg through the pool the adapter names for it. The
///      constructor signature is unchanged from before ExitRouterCore was
///      extracted, so the deployed router's replacement deploys identically.
contract ExitRouter is ExitRouterCore, SwapExecutor {
    constructor(IPoolManager poolManager_) SwapExecutor(poolManager_) {}

    function _sellLeg(address basket, address token, address, uint256 amountIn)
        internal
        override
        returns (uint256)
    {
        (Currency c0, Currency c1, uint24 fee, int24 tickSpacing, IHooks hooks) =
            IExitBasket(basket).poolKeys(token);
        PoolKey memory key =
            PoolKey({currency0: c0, currency1: c1, fee: fee, tickSpacing: tickSpacing, hooks: hooks});
        bool zeroForOne = Currency.unwrap(key.currency0) == token;
        return _executeSwap(SwapRequest({key: key, zeroForOne: zeroForOne, amountIn: amountIn, minAmountOut: 0}));
    }
}
