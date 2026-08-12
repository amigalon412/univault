// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAllocatable {
    function deployIdle(uint256 maxAssets) external returns (uint256);
    function rebalance(address token, uint256 maxTradeAssets, uint16 maxSlippageBps) external returns (uint256);
}

interface IBuyback {
    function collect(address vault, uint256 shares) external returns (uint256);
    function buyback(uint256 maxSpend, uint256 minAmountOut) external returns (uint256);
}

/// @title KeeperGuard
/// @notice The only address a vault trusts to run automation, and the place
///         every limit on that automation is enforced.
///
/// @dev The point of this contract is what it *cannot* be made to do. A keeper
///      key is online, so it will eventually be treated as compromised. The
///      design target is that a fully compromised keeper costs the protocol
///      rounding dust and gas, and nothing else — it cannot move funds to an
///      address of its choosing, cannot unwind a position, cannot change a fee,
///      a buffer or an owner, and cannot act on a vault nobody registered.
///
///      Two actions are automated: allocating idle balance to the lending
///      venue, and rebalancing the split between the legs. Both are bounded by
///      the caller allowlist, the vault allowlist, a per-call size cap and a
///      cooldown. Rebalancing adds a slippage cap, which is the guard's
///      parameter rather than the keeper's — a compromised keeper must not be
///      able to accept a worse fill than the operator chose. Oracle freshness
///      is enforced by the vault itself, which refuses to price a stale basket.
contract KeeperGuard is Ownable {
    /// @notice Hard ceiling on rebalance slippage, matching Safex's own
    ///         `MAX_SLIPPAGE_BPS`. A guard value above this is not merely loose,
    ///         it is inert: the vault reverts `SlippageOutOfRange` on every
    ///         rebalance, silently disabling automation. Rejecting it here makes
    ///         a misconfiguration fail at set-time instead of at run-time.
    uint16 internal constant MAX_SLIPPAGE_BPS = 1_000; // 10%

    /// @notice Keepers permitted to trigger automation.
    mapping(address => bool) public isKeeper;

    /// @notice Vaults this guard is allowed to drive.
    mapping(address => bool) public isVault;

    /// @notice Addresses that may halt automation without being able to run it.
    mapping(address => bool) public isSentinel;

    /// @notice Buyback modules this guard is allowed to drive.
    mapping(address => bool) public isBuyback;

    /// @notice Largest amount of fee revenue a single buyback may spend.
    uint256 public maxBuybackPerCall;

    /// @notice Largest amount a single call may allocate.
    uint256 public maxDeployPerCall;

    /// @notice Largest amount a single rebalance may move between the legs.
    uint256 public maxRebalancePerCall;

    /// @notice Worst fill a rebalance may accept against the oracle price.
    uint16 public maxSlippageBps;

    /// @notice Minimum seconds between actions on the same vault.
    uint32 public cooldown;

    /// @notice When true, every automated action reverts. Owner or sentinel.
    bool public paused;

    mapping(address => uint256) public lastActionAt;

    event KeeperSet(address keeper, bool allowed);
    event VaultSet(address vault, bool allowed);
    event SentinelSet(address sentinel, bool allowed);
    event LimitsUpdated(uint256 maxDeployPerCall, uint32 cooldown);
    event TradeLimitsUpdated(uint256 maxRebalancePerCall, uint16 maxSlippageBps);
    event Rebalanced(address indexed vault, address indexed keeper, address token, uint256 traded);
    event PausedSet(bool paused);
    event Deployed(address indexed vault, address indexed keeper, uint256 assets);
    event BuybackSet(address module, bool allowed);
    event BuybackLimitUpdated(uint256 maxBuybackPerCall);
    event FeesCollected(address indexed module, address indexed vault, uint256 assets);
    event BoughtBack(address indexed module, address indexed keeper, uint256 retired);

    error NotKeeper();
    error NotSentinel();
    error VaultNotAllowed();
    error CoolingDown();
    error Paused();
    error SlippageOutOfRange();
    error BuybackNotAllowed();

    constructor(address owner_, uint256 maxDeployPerCall_, uint32 cooldown_) Ownable(owner_) {
        maxDeployPerCall = maxDeployPerCall_;
        cooldown = cooldown_;
        maxRebalancePerCall = maxDeployPerCall_;
        maxSlippageBps = 100; // 1%
    }

    // ---------------------------------------------------------------------
    // Automation
    // ---------------------------------------------------------------------

    /// @notice Move a vault's idle balance into its lending venue, within limits.
    function deployIdle(address vault) external returns (uint256 deployed) {
        if (paused) revert Paused();
        if (!isKeeper[msg.sender]) revert NotKeeper();
        if (!isVault[vault]) revert VaultNotAllowed();
        // A vault that has never been acted on is not cooling down. Comparing
        // against a zero timestamp would otherwise lock out the first call.
        uint256 last = lastActionAt[vault];
        if (last != 0 && block.timestamp < last + cooldown) revert CoolingDown();

        lastActionAt[vault] = block.timestamp;
        deployed = IAllocatable(vault).deployIdle(maxDeployPerCall);
        emit Deployed(vault, msg.sender, deployed);
    }

    /// @notice Move a vault back toward its target split, within limits.
    /// @dev The keeper names the constituent. It does not choose the direction
    ///      or the size: the vault computes both from the live gap to target
    ///      and this caps them. Slippage is the guard's parameter, not the
    ///      keeper's, so a compromised keeper cannot accept a worse fill.
    function rebalance(address vault, address token) external returns (uint256 traded) {
        if (paused) revert Paused();
        if (!isKeeper[msg.sender]) revert NotKeeper();
        if (!isVault[vault]) revert VaultNotAllowed();

        uint256 last = lastActionAt[vault];
        if (last != 0 && block.timestamp < last + cooldown) revert CoolingDown();

        lastActionAt[vault] = block.timestamp;
        traded = IAllocatable(vault).rebalance(token, maxRebalancePerCall, maxSlippageBps);
        emit Rebalanced(vault, msg.sender, token, traded);
    }

    /// @notice Turn a module's collected fee shares into stable.
    /// @dev Separate from the buyback itself so a redemption that the vault
    ///      refuses to price does not also block spending stable already on
    ///      hand, and so each half gets its own cooldown slot.
    function collectFees(address module, address vault, uint256 shares) external returns (uint256 assets) {
        if (paused) revert Paused();
        if (!isKeeper[msg.sender]) revert NotKeeper();
        if (!isBuyback[module]) revert BuybackNotAllowed();

        assets = IBuyback(module).collect(vault, shares);
        emit FeesCollected(module, vault, assets);
    }

    /// @notice Spend fee revenue on the protocol token and retire it.
    /// @dev The size cap is the guard's, the cooldown is the guard's, and the
    ///      module is one the owner registered. `minAmountOut` is the keeper's,
    ///      because the protocol token has no price feed to check it against —
    ///      see the note on BuybackModule.buyback. That is why the size cap
    ///      exists and why it should be set conservatively.
    function buyback(address module, uint256 minAmountOut) external returns (uint256 retired) {
        if (paused) revert Paused();
        if (!isKeeper[msg.sender]) revert NotKeeper();
        if (!isBuyback[module]) revert BuybackNotAllowed();

        uint256 last = lastActionAt[module];
        if (last != 0 && block.timestamp < last + cooldown) revert CoolingDown();

        lastActionAt[module] = block.timestamp;
        retired = IBuyback(module).buyback(maxBuybackPerCall, minAmountOut);
        emit BoughtBack(module, msg.sender, retired);
    }

    // ---------------------------------------------------------------------
    // Halting
    // ---------------------------------------------------------------------

    /// @dev A sentinel can stop automation but cannot start it or run it. The
    ///      asymmetry is deliberate: halting is safe to hand out widely,
    ///      resuming is not.
    function pause() external {
        if (!isSentinel[msg.sender] && msg.sender != owner()) revert NotSentinel();
        paused = true;
        emit PausedSet(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit PausedSet(false);
    }

    // ---------------------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------------------

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    function setVault(address vault, bool allowed) external onlyOwner {
        isVault[vault] = allowed;
        emit VaultSet(vault, allowed);
    }

    function setBuyback(address module, bool allowed) external onlyOwner {
        isBuyback[module] = allowed;
        emit BuybackSet(module, allowed);
    }

    function setBuybackLimit(uint256 maxBuybackPerCall_) external onlyOwner {
        maxBuybackPerCall = maxBuybackPerCall_;
        emit BuybackLimitUpdated(maxBuybackPerCall_);
    }

    function setSentinel(address sentinel, bool allowed) external onlyOwner {
        isSentinel[sentinel] = allowed;
        emit SentinelSet(sentinel, allowed);
    }

    function setLimits(uint256 maxDeployPerCall_, uint32 cooldown_) external onlyOwner {
        maxDeployPerCall = maxDeployPerCall_;
        cooldown = cooldown_;
        emit LimitsUpdated(maxDeployPerCall_, cooldown_);
    }

    function setTradeLimits(uint256 maxRebalancePerCall_, uint16 maxSlippageBps_) external onlyOwner {
        if (maxSlippageBps_ > MAX_SLIPPAGE_BPS) revert SlippageOutOfRange();
        maxRebalancePerCall = maxRebalancePerCall_;
        maxSlippageBps = maxSlippageBps_;
        emit TradeLimitsUpdated(maxRebalancePerCall_, maxSlippageBps_);
    }
}
