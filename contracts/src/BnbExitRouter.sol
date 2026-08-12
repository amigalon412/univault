// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PancakeV3Executor, IPancakeV3Factory} from "./PancakeV3Executor.sol";
import {ExitRouterCore} from "./ExitRouterCore.sol";

interface IBnbExitBasket {
    /// @dev BnbBasketAdapter's `poolFees` mapping. One number fully describes a
    ///      PancakeSwap v3 route against the vault's stable, because the pool
    ///      address is derived by the factory rather than stored.
    function poolFees(address token) external view returns (uint24 fee);
}

/// @title BnbExitRouter
/// @notice The PancakeSwap v3 exit router. For BNB Chain.
///
/// @dev Reads the tier off the adapter for the same reason its Uniswap v4
///      sibling reads the PoolKey: a route the router keeps its own copy of
///      goes stale the moment the basket changes. Here it matters immediately
///      rather than eventually -- the BNB basket is NOT uniform on day one,
///      with the index ETFs at 0.01% and the single names at 0.25%.
contract BnbExitRouter is ExitRouterCore, PancakeV3Executor {
    constructor(IPancakeV3Factory factory_) PancakeV3Executor(factory_) {}

    function _sellLeg(address basket, address token, address stable, uint256 amountIn)
        internal
        override
        returns (uint256)
    {
        uint24 fee = IBnbExitBasket(basket).poolFees(token);
        if (fee == 0) revert PoolNotFound(token, stable, 0);
        return _executeSwap(
            SwapRequest({tokenIn: token, tokenOut: stable, fee: fee, amountIn: amountIn, minAmountOut: 0})
        );
    }
}
