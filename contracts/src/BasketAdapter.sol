// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {SwapExecutor} from "./SwapExecutor.sol";
import {BasketAdapterCore} from "./BasketAdapterCore.sol";

/// @title BasketAdapter
/// @notice The Uniswap v4 basket adapter. Live on Robinhood Chain.
///
/// @dev Everything about weights, valuation and custody lives in
///      BasketAdapterCore; this fills in the one venue-shaped hole. The
///      constructor signature, the storage layout of `poolKeys`, `setPool` and
///      the `PoolSet` event are all unchanged from before the core was
///      extracted, so the deployed set and every script pointing at it keep
///      working untouched.
contract BasketAdapter is BasketAdapterCore, SwapExecutor {
    /// @notice The pool each constituent trades in, fixed by the owner.
    /// @dev Routing is configuration, not an argument. If the caller could name
    ///      the pool, a compromised caller could route through one it had just
    ///      created and priced to its liking.
    mapping(address token => PoolKey) public poolKeys;

    event PoolSet(address indexed token, address currency0, address currency1, uint24 fee, int24 tickSpacing);

    constructor(address owner_, PriceOracle oracle_, address vault_, address stable_, IPoolManager poolManager_)
        BasketAdapterCore(owner_, oracle_, vault_, stable_)
        SwapExecutor(poolManager_)
    {}

    function _swapVia(address token, address inputToken, uint256 amountIn, uint256 minOut)
        internal
        override
        returns (uint256)
    {
        PoolKey memory key = poolKeys[token];
        if (Currency.unwrap(key.currency0) == address(0) && Currency.unwrap(key.currency1) == address(0)) {
            revert NoPool(token);
        }
        bool zeroForOne = Currency.unwrap(key.currency0) == inputToken;
        return _executeSwap(SwapRequest({key: key, zeroForOne: zeroForOne, amountIn: amountIn, minAmountOut: minOut}));
    }

    /// @dev Rejects a pool that is not exactly this token against the stable,
    ///      so a mis-typed key cannot quietly point trading at another market.
    function setPool(address token, PoolKey calldata key) external onlyOwner {
        if (!constituents[token].set) revert UnknownToken(token);
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        bool pairMatches = (c0 == stable && c1 == token) || (c0 == token && c1 == stable);
        if (!pairMatches) revert PoolAssetMismatch();

        poolKeys[token] = key;
        emit PoolSet(token, c0, c1, key.fee, key.tickSpacing);
    }
}
