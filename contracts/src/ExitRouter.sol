// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapExecutor} from "./SwapExecutor.sol";
import {RobinhoodChain} from "./RobinhoodChain.sol";

interface IExitVault {
    function asset() external view returns (address);
    function redeemInKind(uint256 shares, address receiver, address owner)
        external
        returns (uint256 stableOut, address[] memory tokens, uint256[] memory amounts);
}

/// @title ExitRouter
/// @notice One-transaction "sell everything, pay me in USDG" exit for BLUR
///         vaults that hold a stock basket.
///
/// @dev A BALANCED or GROWTH vault pays priced USDG withdrawals only from its
///      stable leg; the stock leg leaves in kind, as tokens. That is deliberate
///      -- a vault that market-dumped its basket on every withdrawal would give
///      everyone a worse price. This router is the opt-in escape hatch for a
///      holder who wants pure USDG regardless: it redeems their shares in kind
///      and immediately market-sells the stock tokens through their USDG pools,
///      handing back the whole proceeds.
///
///      `minStableOut` is the only protection against a bad or sandwiched fill.
///      The caller sets it from a fresh quote and chooses the slippage they will
///      accept. "Even at a loss" means accepting the market price, not accepting
///      being drained to zero, so a floor is still required.
///
///      The router holds no funds between calls and has no owner or privileged
///      action: it can only do what the caller's own shares and allowance let it.
contract ExitRouter is SwapExecutor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error SharesZero();
    error BelowMin(uint256 received, uint256 minimum);

    event Exited(address indexed user, address indexed vault, uint256 shares, uint256 stableOut);

    constructor(IPoolManager poolManager_) SwapExecutor(poolManager_) {}

    /// @notice Redeem `shares` of `vault` and return the whole value in USDG.
    /// @param vault The BLUR vault (itself an ERC-20) being exited.
    /// @param shares Shares to redeem. The caller must have approved this router
    ///        for at least this many on the vault token first.
    /// @param minStableOut The least total USDG the caller will accept.
    /// @return totalStable USDG sent to the caller.
    function exitToStable(address vault, uint256 shares, uint256 minStableOut)
        external
        nonReentrant
        returns (uint256 totalStable)
    {
        if (shares == 0) revert SharesZero();
        address stable = IExitVault(vault).asset();

        // Redeem in kind to this router: the stable slice as USDG, plus the
        // stock tokens. redeemInKind spends the caller's allowance since the
        // owner passed is msg.sender and the caller is this contract.
        (uint256 stableOut, address[] memory tokens, uint256[] memory amounts) =
            IExitVault(vault).redeemInKind(shares, address(this), msg.sender);
        totalStable = stableOut;

        // Market-sell each stock token into USDG through its basket pool. The
        // per-swap floor is zero on purpose: the only bound that matters is the
        // total below, which cannot be gamed by splitting it across legs.
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;
            PoolKey memory key = RobinhoodChain.basketPool(tokens[i]);
            bool zeroForOne = Currency.unwrap(key.currency0) == tokens[i];
            totalStable += _executeSwap(
                SwapRequest({key: key, zeroForOne: zeroForOne, amountIn: amt, minAmountOut: 0})
            );
        }

        if (totalStable < minStableOut) revert BelowMin(totalStable, minStableOut);
        IERC20(stable).safeTransfer(msg.sender, totalStable);
        emit Exited(msg.sender, vault, shares, totalStable);
    }
}
