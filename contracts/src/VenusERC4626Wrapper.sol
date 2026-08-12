// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev The Compound-style market this wraps. Venus is a Compound v2 fork, so
///      the money-moving calls return an ERROR CODE instead of reverting --
///      that is the whole reason this contract exists as more than a typedef.
interface IVToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function accrueInterest() external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function balanceOf(address owner) external view returns (uint256);
    function underlying() external view returns (address);
    function getCash() external view returns (uint256);
}

/// @title VenusERC4626Wrapper
/// @notice An ERC-4626 face on a Venus market, so Safex can lend into it.
///
/// @dev Safex takes its lending venue as an `IERC4626` and checks in its
///      constructor that `yieldVault.asset()` matches its own asset. Venus's
///      core markets are Compound v2 vTokens and satisfy neither. Venus does
///      ship an official ERC-4626 factory, and it was the first thing tried:
///      `createERC4626` reverts with `VenusERC4626Factory__InvalidVToken` for
///      the core vUSDT market, because that factory only accepts vTokens
///      registered in the isolated-pool `poolRegistry`. Measured on BNB Chain,
///      the isolated USDT pools hold four to five figures with ~3% utilisation
///      while the core market holds nine figures at ~56%. The wrapper Venus
///      gives you is available exactly where the yield is not.
///
///      So: a thin adapter, holding vTokens and nothing else.
///
///      THE TRAP THIS EXISTS TO AVOID. Compound v2 returns a uint error code
///      rather than reverting. `vToken.mint(x)` answering 13 is a *failure*,
///      and a wrapper that ignores the return value would mint 4626 shares
///      against a deposit that never entered the market -- the assets would sit
///      here, `totalAssets` would under-report, and the loss would surface as a
///      quiet share-price drop rather than as a failed transaction. Every call
///      below checks the code and reverts on anything but zero.
contract VenusERC4626Wrapper is ERC4626 {
    using SafeERC20 for IERC20;

    /// @notice The Venus market this lends into.
    IVToken public immutable vToken;

    /// @dev Compound's "no error" code.
    uint256 private constant NO_ERROR = 0;

    error VenusMintFailed(uint256 code);
    error VenusRedeemFailed(uint256 code);
    error UnderlyingMismatch();

    constructor(IERC20 asset_, IVToken vToken_, string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        if (vToken_.underlying() != address(asset_)) revert UnderlyingMismatch();
        vToken = vToken_;
        /* Approved once for the life of the contract. The spender is a single
           immutable market, not a router taking a path from a caller. */
        IERC20(asset_).forceApprove(address(vToken_), type(uint256).max);
    }

    /**
     * @notice Everything this wrapper has lent, plus interest.
     *
     * @dev `exchangeRateStored` is the rate as of the last accrual, not as of
     *      now, so this reads slightly low between blocks that touch the
     *      market. That direction is the safe one: it under-states the share
     *      price, so a redeemer can never be paid out on interest the market
     *      has not actually booked. `_deposit` and `_withdraw` both accrue
     *      first, which is where an exact number actually matters.
     */
    function totalAssets() public view override returns (uint256) {
        return (vToken.balanceOf(address(this)) * vToken.exchangeRateStored()) / 1e18;
    }

    /**
     * @notice What could be redeemed right now.
     *
     * @dev A lending market can be fully utilised, in which case the assets
     *      exist but cannot be withdrawn this block. ERC-4626 has `maxWithdraw`
     *      for exactly this, and Safex's exit path reads it. Reporting the
     *      full balance here would turn "the market is out of cash" into a
     *      failed user withdrawal instead of a smaller one.
     */
    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 owned = super.maxWithdraw(owner);
        uint256 cash = vToken.getCash();
        return owned < cash ? owned : cash;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 owned = super.maxRedeem(owner);
        uint256 byCash = convertToShares(vToken.getCash());
        return owned < byCash ? owned : byCash;
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        /* Accrue BEFORE the shares are priced. Without this the depositor is
           priced against a stale exchange rate and mints slightly too many
           shares, diluting everybody already in. */
        vToken.accrueInterest();
        super._deposit(caller, receiver, assets, shares);
        uint256 code = vToken.mint(assets);
        if (code != NO_ERROR) revert VenusMintFailed(code);
    }

    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        vToken.accrueInterest();
        uint256 code = vToken.redeemUnderlying(assets);
        if (code != NO_ERROR) revert VenusRedeemFailed(code);
        super._withdraw(caller, receiver, owner, assets, shares);
    }
}
