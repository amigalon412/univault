// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IExitVault {
    function asset() external view returns (address);
    function basket() external view returns (address);
    function redeemInKind(uint256 shares, address receiver, address owner)
        external
        returns (uint256 stableOut, address[] memory tokens, uint256[] memory amounts);
}

/// @title ExitRouterCore
/// @notice One-transaction "sell everything, pay me in the stable" exit for a
///         vault that holds a stock basket.
///
/// @dev A BALANCED or GROWTH vault pays priced stablecoin withdrawals only from
///      its stable leg; the stock leg leaves in kind, as tokens. That is
///      deliberate -- a vault that market-dumped its basket on every withdrawal
///      would give everyone a worse price. This router is the opt-in escape
///      hatch for a holder who wants pure stablecoin regardless: it redeems
///      their shares in kind and immediately market-sells the stock tokens,
///      handing back the whole proceeds.
///
///      `minStableOut` is the only protection against a bad or sandwiched fill.
///      The caller sets it from a fresh quote and chooses the slippage they will
///      accept. "Even at a loss" means accepting the market price, not accepting
///      being drained to zero, so a floor is still required.
///
///      The router holds no funds between calls and has no owner or privileged
///      action: it can only do what the caller's own shares and allowance let it.
///
///      The venue is the one hole: `_sellLeg`. ExitRouter fills it with Uniswap
///      v4 and BnbExitRouter with PancakeSwap v3.
abstract contract ExitRouterCore is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error SharesZero();
    error BelowMin(uint256 received, uint256 minimum);

    event Exited(address indexed user, address indexed vault, uint256 shares, uint256 stableOut);

    /// @notice Redeem `shares` of `vault` and return the whole value in stable.
    /// @param vault The vault (itself an ERC-20) being exited.
    /// @param shares Shares to redeem. The caller must have approved this router
    ///        for at least this many on the vault token first.
    /// @param minStableOut The least total the caller will accept.
    /// @return totalStable Stablecoin sent to the caller.
    function exitToStable(address vault, uint256 shares, uint256 minStableOut)
        external
        nonReentrant
        returns (uint256 totalStable)
    {
        if (shares == 0) revert SharesZero();
        address stable = IExitVault(vault).asset();

        // Redeem in kind to this router: the stable slice, plus the stock
        // tokens. redeemInKind spends the caller's allowance since the owner
        // passed is msg.sender and the caller is this contract.
        (uint256 stableOut, address[] memory tokens, uint256[] memory amounts) =
            IExitVault(vault).redeemInKind(shares, address(this), msg.sender);
        totalStable = stableOut;

        // Market-sell each stock token. The per-swap floor is zero on purpose:
        // the only bound that matters is the total below, which cannot be gamed
        // by splitting it across legs.
        address basket = IExitVault(vault).basket();

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amt = amounts[i];
            if (amt == 0) continue;
            totalStable += _sellLeg(basket, tokens[i], stable, amt);
        }

        if (totalStable < minStableOut) revert BelowMin(totalStable, minStableOut);
        IERC20(stable).safeTransfer(msg.sender, totalStable);
        emit Exited(msg.sender, vault, shares, totalStable);
    }

    /**
     * @notice Sell one holding into the stable, through the venue.
     *
     * @dev THE ROUTE IS READ OFF THE ADAPTER, NEVER DERIVED FROM A CONSTANT --
     *      that requirement belongs here, above whichever venue implements it,
     *      because it is the lesson this contract was redeployed to learn.
     *
     *      The first version built every route from a hard-coded 0.30% tier.
     *      True of all four holdings the day it shipped, false the moment the
     *      basket grew: the new names traded at 1%, their 0.30% pools were empty
     *      or absent, the swap reverted and took the WHOLE EXIT with it --
     *      unlike a deposit, this loop has no per-leg fallback. A router that
     *      keeps its own copy of the basket's plumbing goes stale every time the
     *      basket changes; one that reads it cannot.
     */
    function _sellLeg(address basket, address token, address stable, uint256 amountIn)
        internal
        virtual
        returns (uint256 stableOut);
}
