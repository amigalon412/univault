// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BasketAdapter} from "./BasketAdapter.sol";

/// @title BlurVault
/// @notice Tokenized vault that puts idle stablecoin to work in an external
///         lending vault and hands depositors a proportional share of the result.
/// @dev Stage 1 of the protocol: the lending leg only. The tokenized-stock leg
///      and the bounded keeper role are added on top of this, not woven into it —
///      `totalAssets()` is the single seam they extend.
///
///      Custody note, stated precisely because an earlier version of it was
///      wrong. No caller can move another holder's *shares*: there is no such
///      function, and the keeper cannot send assets anywhere of its choosing.
///
///      The owner used to be a different matter: `setBasket` accepted any
///      address, and `rebalance` handed that contract the stable to trade with,
///      so an owner could substitute an adapter they wrote and take the
///      deposits. That is closed. The basket can be set once, only before any
///      share exists, and the slippage a rebalance may accept is a constant
///      rather than an argument -- so no owner action moves assets to an
///      address of its choosing.
///
///      What the owner still holds is the ability to churn: it can move the
///      target split and make the vault trade, losing spread each time, and it
///      can point a constituent at a different pool for the same pair. Both are
///      bounded by MAX_SLIPPAGE_BPS. Costly if abused, not a theft.
contract BlurVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 internal constant BPS = 10_000;

    /// @notice Worst fill any rebalance may accept against the oracle price.
    /// @dev A constant, not a setting. `rebalance` lets its caller name the
    ///      slippage it will tolerate, and at 100% the floor is zero -- a trade
    ///      routed through a pool priced to suit would hand the vault away and
    ///      pass every check. The owner sets those pools, so this has to be
    ///      something the owner cannot raise.
    ///
    ///      Ten percent is far above what the basket pools actually cost: a
    ///      $1,000 trade in the 0.30% tier fills within about 1% of the feed.
    uint16 internal constant MAX_SLIPPAGE_BPS = 1_000;

    /// @notice External ERC-4626 producing the lending yield.
    IERC4626 public immutable yieldVault;

    /// @notice Portion of assets kept liquid so small exits need no unwind, in bps.
    uint16 public bufferBps;

    /// @notice Performance fee, charged only on gains above the high-water mark.
    uint16 public performanceFeeBps;

    /// @notice Highest share price ever reached, in assets per whole share.
    uint256 public highWaterMark;

    /// @notice Where fee shares are minted.
    address public feeRecipient;

    /// @notice Contract allowed to run automation. Zero disables it.
    address public guard;

    /// @notice Equity side of the vault. Zero means this is a lending-only vault.
    BasketAdapter public basket;

    /// @notice Share of the vault targeted at the lending leg, in bps.
    /// @dev 10_000 is STEADY. 6_000 is BALANCED. 3_000 is GROWTH.
    uint16 public targetStableBps;

    /// @dev Cached so USD valuations can be scaled without another external call.
    uint8 private immutable _assetDecimals;

    /// @notice Drift tolerated before a rebalance is allowed, in bps of total.
    /// @dev Trading on noise pays spread for nothing. Nothing happens inside
    ///      the band; outside it, a trade may move the split back to target and
    ///      no further.
    uint16 public driftBandBps;

    /// @notice Worst fill accepted when a deposit allocates itself, in bps.
    /// @dev A deposit puts its own money to work in the same transaction so the
    ///      depositor pays for it and the common path needs no keeper. Each buy
    ///      is bounded by this against the oracle price, the same guarantee the
    ///      guard gives a keeper's rebalance. Best-effort: a constituent whose
    ///      pool cannot fill inside the bound is skipped and left idle for a
    ///      keeper to mop up, so a thin or volatile pool never bricks a deposit.
    uint16 public depositSlippageBps;

    /// @notice When true, a deposit allocates itself in the same transaction.
    /// @dev On by default: the depositor pays for putting their money to work,
    ///      so the steady state needs no keeper. An operator can turn it off to
    ///      fall back to keeper-driven allocation — for a migration, or if the
    ///      pools are unhealthy and idle is preferable to a bad fill.
    bool public autoAllocate;

    event Deployed(uint256 assets);
    event Recalled(uint256 assets);
    event BufferUpdated(uint16 bufferBps);
    event DepositSlippageUpdated(uint16 bps);
    event AutoAllocateSet(bool on);
    event FeeAccrued(uint256 feeAssets, uint256 feeShares, uint256 newHighWaterMark);
    event FeeRecipientUpdated(address recipient);
    event GuardUpdated(address guard);
    event BasketUpdated(address basket, uint16 targetStableBps);
    event Rebalanced(address indexed token, uint256 traded, int256 driftAfterBps);
    event DriftBandUpdated(uint16 bandBps);
    event RedeemedInKind(
        address indexed caller, address indexed receiver, address indexed owner, uint256 shares, uint256 stableOut
    );

    error AssetMismatch();
    error BasketAlreadySet();
    error BasketNotBound();
    error VaultInUse();
    error SplitOutOfRange();
    error NoBasket();
    error WithinBand();
    error SlippageOutOfRange();
    error BufferTooHigh();
    error FeeTooHigh();
    error ZeroFeeRecipient();
    error NotAutomation();

    constructor(IERC20 asset_, IERC4626 yieldVault_, string memory name_, string memory symbol_, address owner_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
        Ownable(owner_)
    {
        if (yieldVault_.asset() != address(asset_)) revert AssetMismatch();
        yieldVault = yieldVault_;
        bufferBps = 500;
        performanceFeeBps = 500;
        feeRecipient = owner_;
        targetStableBps = BPS; // lending-only until a basket is attached
        driftBandBps = 200; // 2%
        depositSlippageBps = 100; // 1%
        autoAllocate = true;
        _assetDecimals = IERC20Metadata(address(asset_)).decimals();
        highWaterMark = _sharePrice();
    }

    /// @dev Virtual shares. Without this, the first depositor can donate assets
    ///      directly to the vault and round the next depositor's shares to zero.
    ///      An offset of 6 makes that attack cost more than it can ever extract.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    /// @inheritdoc ERC4626
    /// @dev Reverts when the basket cannot be priced — a stale feed or an
    ///      unacknowledged split. That deliberately blocks deposits and
    ///      priced withdrawals rather than quoting a share price nobody
    ///      can stand behind. `redeemInKind` stays open in that state.
    function totalAssets() public view override returns (uint256) {
        return _stableAssets() + basketAssets();
    }

    /// @notice Value of the lending leg plus anything sitting idle.
    function stableAssets() public view returns (uint256) {
        return _stableAssets();
    }

    /// @notice Value of the equity leg, in asset units.
    function basketAssets() public view returns (uint256) {
        if (address(basket) == address(0)) return 0;
        return _usdToAssets(basket.totalValueUsd());
    }

    /// @notice How the vault is actually split right now, in bps.
    function currentStableBps() external view returns (uint16) {
        uint256 total = totalAssets();
        if (total == 0) return targetStableBps;
        return uint16((_stableAssets() * BPS) / total);
    }

    /// @notice True when a priced deposit or withdrawal can go through.
    function isPriceable() public view returns (bool) {
        return address(basket) == address(0) || basket.isValuable();
    }

    // ---------------------------------------------------------------------
    // On withdrawal limits
    //
    // A priced exit is paid out of the lending leg. Nothing in this contract
    // sells equity to fund one, so the stable leg is a real ceiling on what
    // `withdraw` and `redeem` can pay, and ERC-4626 requires these to report an
    // amount that would not revert.
    //
    // An earlier version capped by "available liquidity" and was removed for
    // being dead: it computed the value of our whole position, which is what
    // the base behaviour already returns. The difference now is the basket. For
    // a lending-only vault `_stableAssets()` still equals `totalAssets()` and
    // this cap remains inert, exactly as before; for a vault with an equity leg
    // it binds, and it is the only thing standing between an integrator and a
    // reverting withdrawal. Do not remove it again on the strength of the
    // lending-only case.
    //
    // A shortfall at the venue itself is still not knowable in advance — the
    // venue under-reports its own `maxWithdraw` while executing full
    // redemptions — so that failure still surfaces as a revert inside
    // `_withdraw`. Holders past this ceiling exit through `redeemInKind`.
    // ---------------------------------------------------------------------

    function maxWithdraw(address owner) public view override returns (uint256) {
        uint256 position = super.maxWithdraw(owner);
        uint256 stable = _stableAssets();
        if (stable >= totalAssets()) return position;
        return position < stable ? position : stable;
    }

    function maxRedeem(address owner) public view override returns (uint256) {
        uint256 shares = super.maxRedeem(owner);
        uint256 stable = _stableAssets();

        // With no equity leg there is nothing to cap, and saying so explicitly
        // matters: converting the whole balance to shares and back rounds down,
        // so the cap would land one unit under a holder's balance and refuse
        // the one redemption that should always work -- all of it.
        if (stable >= totalAssets()) return shares;

        uint256 payable_ = _convertToShares(stable, Math.Rounding.Floor);
        return shares < payable_ ? shares : payable_;
    }

    // ---------------------------------------------------------------------
    // Performance fee
    //
    // Taken as newly minted shares, never by moving assets out. The fee dilutes
    // holders by its own value; it does not give anyone a withdrawal path. That
    // is what lets the custody claim stay true with a fee in place.
    //
    // The high-water mark tracks the gross share price, so a gain is charged
    // once and a recovery after a drawdown is free. See docs/fees.
    // ---------------------------------------------------------------------

    /// @notice Assets backing one whole share.
    function sharePrice() public view returns (uint256) {
        return _sharePrice();
    }

    /// @notice Mint the fee owed on any gain above the high-water mark.
    /// @dev Permissionless and idempotent. Runs before every change to the share
    ///      count so nobody can enter or exit at a price that has not been
    ///      assessed, which would shift the fee onto the holders who stayed.
    function accrueFee() public returns (uint256 feeShares) {
        uint256 price = _sharePrice();
        if (price <= highWaterMark) return 0;

        uint256 supply = totalSupply();
        uint16 feeBps = performanceFeeBps;
        if (supply == 0 || feeBps == 0) {
            highWaterMark = price;
            return 0;
        }

        uint256 gain = ((price - highWaterMark) * supply) / 10 ** decimals();
        uint256 feeAssets = (gain * feeBps) / BPS;
        uint256 assets = totalAssets();

        if (feeAssets > 0 && assets > feeAssets) {
            // Shares worth exactly feeAssets once minted, allowing for the
            // virtual shares and assets the base contract adds.
            feeShares =
                Math.mulDiv(feeAssets, supply + 10 ** _decimalsOffset(), assets + 1 - feeAssets, Math.Rounding.Floor);
            if (feeShares > 0) _mint(feeRecipient, feeShares);
        }

        highWaterMark = price;
        emit FeeAccrued(feeAssets, feeShares, price);
    }

    function setPerformanceFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > 2_000) revert FeeTooHigh();
        accrueFee(); // settle everything owed at the old rate first
        performanceFeeBps = newFeeBps;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroFeeRecipient();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    // ---------------------------------------------------------------------
    // Entrypoints
    //
    // Every path that changes the share count assesses the fee first.
    // ---------------------------------------------------------------------

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        accrueFee();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        accrueFee();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        accrueFee();
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        accrueFee();
        return super.redeem(shares, receiver, owner);
    }

    // ---------------------------------------------------------------------
    // In-kind redemption
    // ---------------------------------------------------------------------

    /// @notice Burn shares and take a pro-rata slice of everything the vault
    ///         holds — stablecoin and equities alike — without selling anything.
    ///
    /// @dev Consults no price at any point. The slice is `shares / totalSupply`,
    ///      which is arithmetic on the share ledger alone, so this path keeps
    ///      working when feeds are stale, the equity market is shut, or a split
    ///      is pending. Those are exactly the moments an exit matters, and they
    ///      are exactly the moments `totalAssets()` refuses to answer.
    ///
    ///      The fee is skipped when the vault cannot be priced. Charging it
    ///      would require a share price, and trapping a holder's funds to
    ///      protect a fee is the wrong way round.
    function redeemInKind(uint256 shares, address receiver, address owner)
        external
        nonReentrant
        returns (uint256 stableOut, address[] memory tokens, uint256[] memory amounts)
    {
        if (isPriceable()) accrueFee();

        if (msg.sender != owner) _spendAllowance(owner, msg.sender, shares);

        uint256 supply = totalSupply();
        uint256 idleShare = (_idle() * shares) / supply;
        uint256 venueShare = (yieldVault.convertToAssets(yieldVault.balanceOf(address(this))) * shares) / supply;

        // Burn before moving anything out.
        _burn(owner, shares);

        if (venueShare > 0) {
            yieldVault.withdraw(venueShare, address(this), address(this));
            emit Recalled(venueShare);
        }

        stableOut = idleShare + venueShare;
        if (stableOut > 0) IERC20(asset()).safeTransfer(receiver, stableOut);

        if (address(basket) != address(0)) {
            (tokens, amounts) = basket.sendSliceToVault(shares, supply);
            for (uint256 i; i < tokens.length; ++i) {
                if (amounts[i] > 0) IERC20(tokens[i]).safeTransfer(receiver, amounts[i]);
            }
        }

        emit RedeemedInKind(msg.sender, receiver, owner, shares, stableOut);
    }

    // ---------------------------------------------------------------------
    // Allocation
    // ---------------------------------------------------------------------

    /// @notice Move idle assets above the buffer into the lending vault.
    function deployIdle() external returns (uint256) {
        return _deployIdle(type(uint256).max);
    }

    /// @notice Same, but never moving more than `maxAssets` in one call.
    /// @dev The bounded form exists so KeeperGuard can enforce a size cap. A
    ///      cap is only meaningful if the caller cannot ask for everything.
    function deployIdle(uint256 maxAssets) external returns (uint256) {
        return _deployIdle(maxAssets);
    }

    function _deployIdle(uint256 maxAssets) internal returns (uint256) {
        _requireAutomation();
        return _deployToVenue(maxAssets);
    }

    /// @dev The allocation itself, without the automation gate. Reachable by a
    ///      keeper through `_deployIdle` and by a depositor through
    ///      `_allocateOnDeposit`; both only ever move stable toward the lending
    ///      leg, never out of the vault, so neither needs the gate.
    function _deployToVenue(uint256 maxAssets) internal returns (uint256 deployed) {
        uint256 idle = _idle();
        uint256 target = (totalAssets() * bufferBps) / BPS;
        if (idle <= target) return 0;

        deployed = idle - target;
        if (deployed > maxAssets) deployed = maxAssets;
        if (deployed == 0) return 0;

        IERC20(asset()).forceApprove(address(yieldVault), deployed);
        yieldVault.deposit(deployed, address(this));
        emit Deployed(deployed);
    }

    // ---------------------------------------------------------------------
    // Deposit-time allocation
    //
    // A deposit puts its own money to work in the same transaction: it buys the
    // basket toward its target weights and lends the rest. The depositor pays
    // for it, so the steady state needs no keeper and the protocol carries no
    // gas bill that grows with deposits. Only a rare price-drift rebalance is
    // left for a keeper.
    //
    // It moves nothing out of the vault and cannot overshoot the target split —
    // the same reasons `rebalance` is safe to expose to a keeper — so it runs
    // without a caller check, inside the deposit that triggered it.
    // ---------------------------------------------------------------------

    function _allocateOnDeposit() internal {
        // Buy the basket toward target weights, funded by the stable now sitting
        // above target. Skipped for a lending-only vault and while the basket
        // cannot be priced.
        if (address(basket) != address(0) && targetStableBps < BPS && isPriceable()) {
            uint256 total = totalAssets();
            uint256 targetStable = (total * targetStableBps) / BPS;
            uint256 stable = _stableAssets();

            if (stable > targetStable) {
                uint256 budget = stable - targetStable; // stable to move into equity
                uint256 equityTarget = total - targetStable; // value the equity leg should reach
                uint256 n = basket.tokensLength();

                for (uint256 i; i < n && budget > 0; ++i) {
                    address token = basket.tokens(i);
                    (uint16 weightBps,,,) = basket.constituents(token);
                    uint256 tokenTarget = (equityTarget * weightBps) / BPS;
                    uint256 held = _usdToAssets(basket.valueOf(token));
                    if (held >= tokenTarget) continue;

                    uint256 want = tokenTarget - held;
                    if (want > budget) want = budget;

                    budget -= _buyEquityBestEffort(token, want);
                }
            }
        }

        // Whatever stable remains above the buffer earns yield in the venue.
        _deployToVenue(type(uint256).max);
    }

    /// @dev Buy `assetsIn` of `token`, bounded by the deposit slippage against
    ///      the oracle. Returns the stable actually spent — zero if the pool
    ///      could not fill inside the bound, in which case the pre-sent stable
    ///      is swept back so nothing is stranded in the basket.
    function _buyEquityBestEffort(address token, uint256 assetsIn) internal returns (uint256 spent) {
        uint256 idle = _idle();
        if (assetsIn > idle) assetsIn = idle; // spend only what is on hand
        if (assetsIn == 0) return 0;

        IERC20(asset()).safeTransfer(address(basket), assetsIn);
        uint256 minOut = (_expectedTokensFor(token, assetsIn) * (BPS - depositSlippageBps)) / BPS;

        try basket.buy(token, assetsIn, minOut) returns (uint256) {
            spent = assetsIn;
        } catch {
            basket.sweepStableToVault();
            spent = 0;
        }
    }

    // ---------------------------------------------------------------------
    // Rebalancing
    // ---------------------------------------------------------------------

    /// @notice How far the split has drifted from target, in bps of total, and
    ///         which way. Positive means over-weight stablecoin.
    function driftBps() public view returns (int256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        int256 current = int256((_stableAssets() * BPS) / total);
        return current - int256(uint256(targetStableBps));
    }

    /// @notice True when drift is outside the band and a trade is warranted.
    function needsRebalance() external view returns (bool) {
        if (address(basket) == address(0) || !isPriceable()) return false;
        int256 d = driftBps();
        return (d < 0 ? uint256(-d) : uint256(d)) > driftBandBps;
    }

    /// @notice Trade one constituent back toward the target split.
    /// @param token Constituent to trade.
    /// @param maxTradeAssets Ceiling on the size of the trade, in asset units.
    /// @param maxSlippageBps Worst acceptable fill against the oracle price.
    /// @return traded Asset value actually moved between the legs.
    ///
    /// @dev The caller chooses which constituent and how much at most. It does
    ///      not choose the direction, and it cannot overshoot: the amount is
    ///      computed here from the live gap to target and then capped. A caller
    ///      that asks for more than the gap simply closes the gap.
    ///
    ///      Nothing happens while drift is inside the band, so a keeper cannot
    ///      grind the vault down by trading it back and forth at the target.
    function rebalance(address token, uint256 maxTradeAssets, uint16 maxSlippageBps)
        external
        nonReentrant
        returns (uint256 traded)
    {
        _requireAutomation();
        if (address(basket) == address(0)) revert NoBasket();
        if (maxSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageOutOfRange();

        accrueFee();

        uint256 total = totalAssets();
        uint256 stable = _stableAssets();
        uint256 targetStable = (total * targetStableBps) / BPS;
        uint256 band = (total * driftBandBps) / BPS;

        if (stable > targetStable) {
            uint256 gap = stable - targetStable;
            if (gap <= band) revert WithinBand();
            traded = gap > maxTradeAssets ? maxTradeAssets : gap;
            _buyEquity(token, traded, maxSlippageBps);
        } else {
            uint256 gap = targetStable - stable;
            if (gap <= band) revert WithinBand();
            traded = gap > maxTradeAssets ? maxTradeAssets : gap;
            _sellEquity(token, traded, maxSlippageBps);
        }

        emit Rebalanced(token, traded, driftBps());
    }

    function _buyEquity(address token, uint256 assetsIn, uint16 maxSlippageBps) internal {
        // Free the stablecoin up if it is sitting in the lending venue.
        uint256 idle = _idle();
        if (idle < assetsIn) {
            yieldVault.withdraw(assetsIn - idle, address(this), address(this));
            emit Recalled(assetsIn - idle);
        }

        IERC20(asset()).safeTransfer(address(basket), assetsIn);
        uint256 minOut = _expectedTokensFor(token, assetsIn);
        minOut = (minOut * (BPS - maxSlippageBps)) / BPS;
        basket.buy(token, assetsIn, minOut);
    }

    function _sellEquity(address token, uint256 assetsOut, uint16 maxSlippageBps) internal {
        uint256 amountIn = _tokensWorth(token, assetsOut);
        uint256 held = IERC20(token).balanceOf(address(basket));
        if (amountIn > held) amountIn = held;

        uint256 minOut = (assetsOut * (BPS - maxSlippageBps)) / BPS;
        basket.sell(token, amountIn, minOut);
    }

    /// @dev Tokens the oracle says `assets` should buy, before slippage.
    function _expectedTokensFor(address token, uint256 assets) internal view returns (uint256) {
        (, uint8 tokenDecimals,,) = basket.constituents(token);
        uint256 usd = assets * (10 ** (18 - _assetDecimals));
        return (usd * (10 ** tokenDecimals)) / basket.oracle().priceUsd(token);
    }

    /// @dev Tokens whose oracle value is `assets`.
    function _tokensWorth(address token, uint256 assets) internal view returns (uint256) {
        return _expectedTokensFor(token, assets);
    }

    function setDriftBandBps(uint16 newBandBps) external onlyOwner {
        if (newBandBps > BPS) revert SplitOutOfRange();
        driftBandBps = newBandBps;
        emit DriftBandUpdated(newBandBps);
    }

    /// @notice Worst fill a self-allocating deposit may accept, in bps.
    function setDepositSlippageBps(uint16 newSlippageBps) external onlyOwner {
        if (newSlippageBps > MAX_SLIPPAGE_BPS) revert SlippageOutOfRange();
        depositSlippageBps = newSlippageBps;
        emit DepositSlippageUpdated(newSlippageBps);
    }

    /// @notice Turn deposit-time self-allocation on or off.
    function setAutoAllocate(bool on) external onlyOwner {
        autoAllocate = on;
        emit AutoAllocateSet(on);
    }

    /// @notice Address permitted to run automation alongside the owner.
    /// @dev Setting it to the zero address turns automation off entirely.
    function setGuard(address newGuard) external onlyOwner {
        guard = newGuard;
        emit GuardUpdated(newGuard);
    }

    /// @dev Automation may allocate. It may not unwind, retune or reprice
    ///      anything — those stay with the owner. See KeeperGuard.
    function _requireAutomation() internal view {
        if (msg.sender != owner() && msg.sender != guard) revert NotAutomation();
    }

    /// @notice Recover stablecoin sitting in the adapter back into the vault.
    /// @dev The adapter values only its constituents, so stable that ends up
    ///      there -- a donation, a mistaken transfer -- is counted by nobody and
    ///      would be stuck. The adapter's own sweep is `onlyVault`, which means
    ///      it is reachable only through this function; without it the recovery
    ///      path its comment promises does not exist.
    function sweepBasketStable() external returns (uint256) {
        _requireAutomation();
        if (address(basket) == address(0)) revert NoBasket();
        return basket.sweepStableToVault();
    }

    /// @notice Pull everything back out of the lending vault into idle.
    /// @dev Escape hatch. Moves assets toward depositors, never away from them.
    function recallAll() external onlyOwner returns (uint256 recalled) {
        uint256 shares = yieldVault.balanceOf(address(this));
        if (shares == 0) return 0;
        recalled = yieldVault.redeem(shares, address(this), address(this));
        emit Recalled(recalled);
    }

    /// @notice Attach the equity leg and set the target split. Once only.
    ///
    /// @dev This used to be changeable, and that was the whole of the drain:
    ///      an owner could point the vault at an adapter they wrote and a
    ///      rebalance would hand it the deposits. No check can distinguish an
    ///      honest adapter from a dishonest one, so the answer is to make the
    ///      choice unrepeatable rather than to police it.
    ///
    ///      Two conditions, and the second matters as much as the first: the
    ///      basket must be unset, and the vault must have issued no shares.
    ///      Without the share check an owner could take deposits first and
    ///      substitute afterwards, which is the same attack with a delay.
    ///      Together they mean the basket is fixed before anyone can be exposed
    ///      to it, and changing the equity leg later means a new vault.
    ///
    ///      The adapter is checked to already point back at this vault and at
    ///      the same asset. That catches a misdeployment, not a malicious one.
    ///
    ///      Known nuisance: anyone can deposit into a freshly deployed vault
    ///      before its basket is set and leave it lending-only for good. It
    ///      costs them a deposit, it strands nothing, and the remedy is to
    ///      deploy again -- which is why this is a nuisance and not a hole.
    function setBasket(BasketAdapter newBasket, uint16 newTargetStableBps) external onlyOwner {
        if (newTargetStableBps > BPS) revert SplitOutOfRange();
        if (address(basket) != address(0)) revert BasketAlreadySet();
        if (totalSupply() != 0) revert VaultInUse();
        if (newBasket.vault() != address(this)) revert BasketNotBound();
        if (newBasket.stable() != asset()) revert AssetMismatch();

        basket = newBasket;
        targetStableBps = newTargetStableBps;
        emit BasketUpdated(address(newBasket), newTargetStableBps);
    }

    function setTargetStableBps(uint16 newTargetStableBps) external onlyOwner {
        if (newTargetStableBps > BPS) revert SplitOutOfRange();
        targetStableBps = newTargetStableBps;
        emit BasketUpdated(address(basket), newTargetStableBps);
    }

    function setBufferBps(uint16 newBufferBps) external onlyOwner {
        if (newBufferBps > BPS) revert BufferTooHigh();
        bufferBps = newBufferBps;
        emit BufferUpdated(newBufferBps);
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _idle() internal view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function _sharePrice() internal view returns (uint256) {
        return _convertToAssets(10 ** decimals(), Math.Rounding.Floor);
    }

    function _stableAssets() internal view returns (uint256) {
        return _idle() + yieldVault.convertToAssets(yieldVault.balanceOf(address(this)));
    }

    /// @dev USDG is treated as exactly one dollar. There is no USDG/USD feed on
    ///      this chain to do better, so the assumption is stated rather than
    ///      hidden: a depeg misprices the equity leg against the stable leg.
    function _usdToAssets(uint256 usd) internal view returns (uint256) {
        return usd / (10 ** (18 - _assetDecimals));
    }

    /// @dev Top up idle from the lending vault before paying an exit.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        uint256 idle = _idle();
        if (idle < assets) {
            uint256 missing = assets - idle;
            yieldVault.withdraw(missing, address(this), address(this));
            emit Recalled(missing);
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override nonReentrant {
        super._deposit(caller, receiver, assets, shares);
        if (autoAllocate) _allocateOnDeposit();
    }
}
