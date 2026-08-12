// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {SwapExecutor} from "./SwapExecutor.sol";

interface IERC20Burnable {
    function burn(uint256 amount) external;
}

/// @title BuybackModule
/// @notice Turns performance-fee revenue into the protocol token and retires it.
///
/// @dev The fee arrives as vault *shares*, not as cash: `Safex.accrueFee`
///      mints shares to its fee recipient rather than moving assets, so setting
///      this contract as that recipient is all the plumbing there is. From
///      there the cycle is redeem shares for USDG, buy the token, retire it.
///
///      A bought token is retired one of two ways, chosen explicitly at deploy
///      rather than guessed at runtime:
///
///      1. `burnsSupply` true: the module calls `burn` on the token, and
///         `totalSupply` actually falls. This is the intended configuration,
///         and it requires the token to expose `burn(uint256)`. If it does not,
///         every buyback reverts -- loudly, rather than quietly falling back to
///         something weaker than what was promised.
///      2. `burnsSupply` false: the tokens are sent to an address nobody holds
///         the key to. This is the only option for a token that cannot be
///         burned, and supply stays where it is. The destination cannot be
///         `address(0)`, which OpenZeppelin's ERC-20 refuses with
///         `ERC20InvalidReceiver`.
///
///      `totalRetired` counts both, so it is the figure to quote either way.
///
///      What this contract deliberately cannot do: it holds no depositor
///      funds. Everything that reaches it is fee revenue the owner is already
///      entitled to redirect by pointing the vault's fee recipient elsewhere,
///      which is why a sweep exists and is not a new power.
contract BuybackModule is SwapExecutor, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev Not `address(0)`: this token reverts on a transfer there.
    address public constant GRAVEYARD = 0x000000000000000000000000000000000000dEaD;

    /// @notice The asset fees are denominated in, and what buybacks spend.
    address public immutable stable;

    /// @notice The protocol token being bought and retired.
    address public immutable token;

    /// @notice The v4 pool a buyback trades through. Owner-set, never inferred.
    PoolKey public pool;

    /// @notice Vaults whose fee shares this contract will redeem.
    mapping(address => bool) public isVault;

    /// @notice Contract permitted to run automation alongside the owner.
    address public guard;

    /// @notice Largest amount of stable a single buyback may spend.
    uint256 public maxSpendPerCall;

    /// @notice True to burn what is bought, false to send it to the graveyard.
    bool public burnsSupply;

    /// @notice Cumulative token amount retired by this contract, either way.
    uint256 public totalRetired;

    /// @notice Cumulative stable spent buying it.
    uint256 public totalSpent;

    event VaultSet(address vault, bool allowed);
    event GuardUpdated(address guard);
    event PoolSet(address currency0, address currency1, uint24 fee, int24 tickSpacing);
    event MaxSpendUpdated(uint256 maxSpendPerCall);
    event BurnsSupplyUpdated(bool burnsSupply);
    event FeesCollected(address indexed vault, uint256 shares, uint256 assets);
    event BoughtBack(uint256 spent, uint256 retired, bool burned);
    event Swept(address indexed asset, address indexed to, uint256 amount);

    error NotAutomation();
    error PoolNotSet();
    error PoolAssetMismatch();
    error VaultNotAllowed();
    error VaultAssetMismatch();
    error NothingToSpend();
    error ZeroMinimum();
    error CannotSweepToGraveyard();

    constructor(address owner_, address stable_, address token_, IPoolManager poolManager_, bool burnsSupply_)
        SwapExecutor(poolManager_)
        Ownable(owner_)
    {
        stable = stable_;
        token = token_;
        burnsSupply = burnsSupply_;
        maxSpendPerCall = type(uint256).max;
    }

    modifier onlyAutomation() {
        if (msg.sender != owner() && msg.sender != guard) revert NotAutomation();
        _;
    }

    // ---------------------------------------------------------------------
    // The cycle
    // ---------------------------------------------------------------------

    /// @notice Redeem fee shares held by this contract for stable.
    /// @dev Redeems through the vault's ordinary exit, so it is subject to the
    ///      same refusal to price a stale basket that protects depositors. The
    ///      fee stream waits rather than being valued on a bad price.
    function collect(address vault, uint256 shares) external onlyAutomation nonReentrant returns (uint256 assets) {
        if (!isVault[vault]) revert VaultNotAllowed();

        uint256 held = IERC20(vault).balanceOf(address(this));
        if (shares > held) shares = held;
        if (shares == 0) return 0;

        assets = IERC4626(vault).redeem(shares, address(this), address(this));
        emit FeesCollected(vault, shares, assets);
    }

    /// @notice Spend stable on the protocol token and retire what is bought.
    ///
    /// @param maxSpend Upper bound for this call, further capped by the balance
    ///        on hand and by `maxSpendPerCall`.
    /// @param minAmountOut Least the swap may return, enforced by SwapExecutor
    ///        on the amount actually received.
    ///
    /// @dev `minAmountOut` is supplied by the caller, unlike the rebalance path
    ///      where slippage is the guard's parameter rather than the keeper's.
    ///      The difference is not an oversight: rebalancing trades assets that
    ///      have Chainlink feeds, so a fair price can be asserted on-chain.
    ///      This token has no feed, and the pool's own spot price is worthless
    ///      as a reference because an attacker who sandwiches this transaction
    ///      moves that spot first -- the check would validate against the very
    ///      price being manipulated.
    ///
    ///      So the bound here is size, not price: `maxSpendPerCall` plus the
    ///      guard's cooldown put a ceiling on what a compromised keeper can
    ///      lose per unit time, and what it can lose is fee revenue rather
    ///      than anyone's principal. Set `maxSpendPerCall` accordingly.
    function buyback(uint256 maxSpend, uint256 minAmountOut)
        external
        onlyAutomation
        nonReentrant
        returns (uint256 retired)
    {
        if (Currency.unwrap(pool.currency0) == address(0) && Currency.unwrap(pool.currency1) == address(0)) {
            revert PoolNotSet();
        }
        // A zero minimum accepts any fill, including one dust unit against a
        // drained pool. Refuse it outright rather than trusting the caller.
        if (minAmountOut == 0) revert ZeroMinimum();

        uint256 spend = IERC20(stable).balanceOf(address(this));
        if (spend > maxSpend) spend = maxSpend;
        if (spend > maxSpendPerCall) spend = maxSpendPerCall;
        if (spend == 0) revert NothingToSpend();

        // No approval: v4 is settled by sync-transfer-settle inside the unlock
        // callback, so the manager is paid directly rather than pulling.
        retired = _executeSwap(
            SwapRequest({
                key: pool,
                zeroForOne: Currency.unwrap(pool.currency0) == stable,
                amountIn: spend,
                minAmountOut: minAmountOut
            })
        );

        // Retire what was bought, not what was expected: the swap may return
        // more than the minimum, and none of it should be left sitting here.
        if (burnsSupply) {
            IERC20Burnable(token).burn(retired);
        } else {
            IERC20(token).safeTransfer(GRAVEYARD, retired);
        }

        totalRetired += retired;
        totalSpent += spend;
        emit BoughtBack(spend, retired, burnsSupply);
    }

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    /// @dev Validated to be exactly this pair, in either order. A key naming
    ///      some other pool would send the whole fee stream into it.
    function setPool(PoolKey calldata key) external onlyOwner {
        address c0 = Currency.unwrap(key.currency0);
        address c1 = Currency.unwrap(key.currency1);
        bool pairMatches = (c0 == stable && c1 == token) || (c0 == token && c1 == stable);
        if (!pairMatches) revert PoolAssetMismatch();

        pool = key;
        emit PoolSet(c0, c1, key.fee, key.tickSpacing);
    }

    /// @dev The vault's asset must match what this contract spends, or `collect`
    ///      would fill it with a token no configured pool can trade.
    function setVault(address vault, bool allowed) external onlyOwner {
        if (allowed && IERC4626(vault).asset() != stable) revert VaultAssetMismatch();
        isVault[vault] = allowed;
        emit VaultSet(vault, allowed);
    }

    function setGuard(address newGuard) external onlyOwner {
        guard = newGuard;
        emit GuardUpdated(newGuard);
    }

    function setMaxSpendPerCall(uint256 newMax) external onlyOwner {
        maxSpendPerCall = newMax;
        emit MaxSpendUpdated(newMax);
    }

    /// @dev Deliberately not auto-detected. Whether the protocol reduces its own
    ///      supply is a claim the docs make to holders, so it is a decision the
    ///      owner records on-chain rather than a behaviour that changes silently
    ///      depending on what the token happens to implement.
    function setBurnsSupply(bool newBurnsSupply) external onlyOwner {
        burnsSupply = newBurnsSupply;
        emit BurnsSupplyUpdated(newBurnsSupply);
    }

    /// @notice Recover anything sitting here, including an in-kind redemption
    ///         that arrived as basket tokens rather than stable.
    /// @dev This is not a back door onto depositor funds -- nothing here is
    ///      theirs. It is the same authority the owner already has by pointing
    ///      a vault's fee recipient somewhere else, made explicit.
    function sweep(address asset, address to, uint256 amount) external onlyOwner {
        // Sweeping to the graveyard would look like a retirement in the token's
        // transfer history while bypassing the accounting above.
        if (to == GRAVEYARD) revert CannotSweepToGraveyard();
        IERC20(asset).safeTransfer(to, amount);
        emit Swept(asset, to, amount);
    }
}
