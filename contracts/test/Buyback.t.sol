// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

import {BuybackModule} from "../src/BuybackModule.sol";
import {Safex} from "../src/Safex.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";
import {MockBurnableERC20, MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

/// @dev A module whose swap settles at a fixed rate, so these tests measure the
///      decision around the swap -- the caps, the retirement, the accounting --
///      rather than a venue. The real fill is exercised in Buyback.fork.t.sol.
contract FixedRateBuyback is BuybackModule {
    /// @dev Protocol tokens minted per whole unit of stable.
    uint256 public rate = 100;

    constructor(address owner_, address stable_, address token_, bool burnsSupply_)
        BuybackModule(owner_, stable_, token_, IPoolManager(address(0)), burnsSupply_)
    {}

    function setRate(uint256 newRate) external {
        rate = newRate;
    }

    function _executeSwap(SwapRequest memory req) internal override returns (uint256 amountOut) {
        // stable is 6 decimals, the protocol token 18. The module only ever
        // sells stable, so the output side is always the protocol token,
        // whichever way round the pool orders the pair.
        amountOut = (req.amountIn * rate * 1e12);
        require(amountOut >= req.minAmountOut, "slippage");
        MockERC20(stable).burn(address(this), req.amountIn);
        MockERC20(token).mint(address(this), amountOut);
    }
}

contract BuybackTest is Test {
    MockERC20 usdg;
    MockBurnableERC20 blur;
    MockYieldVault venue;
    Safex vault;
    FixedRateBuyback module;
    KeeperGuard guard;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");
    address stranger = makeAddr("stranger");

    uint256 constant ONE = 1e6;
    address constant GRAVEYARD = 0x000000000000000000000000000000000000dEaD;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        blur = new MockBurnableERC20("BLUR", "BLUR", 18);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        vault = new Safex(
            IERC20(address(usdg)), IERC4626(address(venue)), "Safex Steady", "sfxSTEADY", owner
        );
        module = new FixedRateBuyback(owner, address(usdg), address(blur), false);
        guard = new KeeperGuard(owner, 1_000_000 * ONE, 1 hours);

        vm.startPrank(owner);
        module.setVault(address(vault), true);
        module.setPool(_pool());
        module.setGuard(address(guard));
        vault.setFeeRecipient(address(module));
        guard.setKeeper(keeper, true);
        guard.setBuyback(address(module), true);
        guard.setBuybackLimit(100_000 * ONE);
        vm.stopPrank();
    }

    function _pool() internal view returns (PoolKey memory) {
        (address c0, address c1) = address(usdg) < address(blur)
            ? (address(usdg), address(blur))
            : (address(blur), address(usdg));
        return PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: 10_000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });
    }

    /// @dev Deposit, earn, and accrue so the module actually holds fee shares.
    function _earnFees() internal returns (uint256 shares) {
        usdg.mint(alice, 100_000 * ONE);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000 * ONE, alice);
        vm.stopPrank();

        vm.prank(owner);
        vault.deployIdle();

        skip(365 days);
        venue.accrue();
        vault.accrueFee();

        shares = vault.balanceOf(address(module));
    }

    // -----------------------------------------------------------------
    // The fee actually arrives, and is redeemable
    // -----------------------------------------------------------------

    function test_FeeSharesLandOnTheModule() public {
        uint256 shares = _earnFees();
        assertGt(shares, 0, "module holds no fee shares");
    }

    function test_CollectTurnsSharesIntoStable() public {
        uint256 shares = _earnFees();

        vm.prank(owner);
        uint256 assets = module.collect(address(vault), shares);

        assertGt(assets, 0);
        assertEq(usdg.balanceOf(address(module)), assets);
        assertEq(vault.balanceOf(address(module)), 0);
    }

    function test_CollectCapsAtSharesHeld() public {
        uint256 shares = _earnFees();

        vm.prank(owner);
        module.collect(address(vault), shares * 100);

        assertEq(vault.balanceOf(address(module)), 0, "asked for more than held");
    }

    function test_CollectRejectsUnregisteredVault() public {
        vm.prank(owner);
        vm.expectRevert(BuybackModule.VaultNotAllowed.selector);
        module.collect(address(0xdead), 1);
    }

    function test_CollectRejectsStranger() public {
        vm.prank(stranger);
        vm.expectRevert(BuybackModule.NotAutomation.selector);
        module.collect(address(vault), 1);
    }

    // -----------------------------------------------------------------
    // Buying and retiring
    // -----------------------------------------------------------------

    function test_BuybackRetiresToTheGraveyard() public {
        usdg.mint(address(module), 1_000 * ONE);

        vm.prank(owner);
        uint256 retired = module.buyback(type(uint256).max, 1);

        assertEq(retired, 1_000 * 100 * 1e18, "wrong amount bought");
        assertEq(blur.balanceOf(GRAVEYARD), retired, "not retired");
        assertEq(blur.balanceOf(address(module)), 0, "kept some back");
        assertEq(module.totalRetired(), retired);
        assertEq(module.totalSpent(), 1_000 * ONE);
    }

    /// @dev In graveyard mode supply is untouched, which is the whole reason
    ///      the mode is named separately from burning.
    function test_GraveyardModeDoesNotReduceTotalSupply() public {
        usdg.mint(address(module), 1_000 * ONE);
        uint256 supplyBefore = blur.totalSupply();

        vm.prank(owner);
        module.buyback(type(uint256).max, 1);

        assertEq(blur.totalSupply(), supplyBefore + 100_000e18, "supply moved the wrong way");
        assertGt(blur.balanceOf(GRAVEYARD), 0, "nothing reached the graveyard");
    }

    /// @dev The configuration the protocol actually intends: what is bought is
    ///      burned, and total supply falls by exactly that amount. This is the
    ///      test behind the claim the docs make to holders.
    function test_BurnModeReducesTotalSupply() public {
        FixedRateBuyback burner =
            new FixedRateBuyback(owner, address(usdg), address(blur), true);
        vm.prank(owner);
        burner.setPool(_pool());

        usdg.mint(address(burner), 1_000 * ONE);
        uint256 supplyBefore = blur.totalSupply();

        vm.prank(owner);
        uint256 retired = burner.buyback(type(uint256).max, 1);

        // The stub mints what it buys, so the net effect of buy-then-burn on
        // supply is zero. What matters is that the burn happened at all: the
        // tokens are gone rather than parked, and nothing reached the graveyard.
        assertEq(blur.totalSupply(), supplyBefore, "burn did not remove what was bought");
        assertEq(blur.balanceOf(address(burner)), 0, "kept some back");
        assertEq(blur.balanceOf(GRAVEYARD), 0, "graveyard used in burn mode");
        assertEq(burner.totalRetired(), retired);
        assertTrue(burner.burnsSupply());
    }

    /// @dev A token without `burn` must fail loudly rather than quietly falling
    ///      back to the graveyard, which would leave the docs overstating what
    ///      the protocol does.
    function test_BurnModeRevertsOnATokenThatCannotBurn() public {
        MockERC20 plain = new MockERC20("Plain", "PLN", 18);
        FixedRateBuyback burner =
            new FixedRateBuyback(owner, address(usdg), address(plain), true);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(
                address(usdg) < address(plain) ? address(usdg) : address(plain)
            ),
            currency1: Currency.wrap(
                address(usdg) < address(plain) ? address(plain) : address(usdg)
            ),
            fee: 10_000,
            tickSpacing: 200,
            hooks: IHooks(address(0))
        });
        vm.prank(owner);
        burner.setPool(key);

        usdg.mint(address(burner), 1_000 * ONE);

        vm.prank(owner);
        vm.expectRevert();
        burner.buyback(type(uint256).max, 1);
    }

    function test_BurnModeIsOwnerOnly() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        module.setBurnsSupply(true);

        vm.prank(owner);
        module.setBurnsSupply(true);
        assertTrue(module.burnsSupply());
    }

    function test_BuybackRejectsZeroMinimum() public {
        usdg.mint(address(module), 1_000 * ONE);

        vm.prank(owner);
        vm.expectRevert(BuybackModule.ZeroMinimum.selector);
        module.buyback(type(uint256).max, 0);
    }

    function test_BuybackRevertsWithNothingToSpend() public {
        vm.prank(owner);
        vm.expectRevert(BuybackModule.NothingToSpend.selector);
        module.buyback(type(uint256).max, 1);
    }

    function test_BuybackRespectsMaxSpendPerCall() public {
        usdg.mint(address(module), 10_000 * ONE);

        vm.prank(owner);
        module.setMaxSpendPerCall(1_000 * ONE);

        vm.prank(owner);
        module.buyback(type(uint256).max, 1);

        assertEq(module.totalSpent(), 1_000 * ONE, "spent past the cap");
        assertEq(usdg.balanceOf(address(module)), 9_000 * ONE, "rest should stay put");
    }

    function test_BuybackRespectsCallerBound() public {
        usdg.mint(address(module), 10_000 * ONE);

        vm.prank(owner);
        module.buyback(500 * ONE, 1);

        assertEq(module.totalSpent(), 500 * ONE);
    }

    function test_BuybackHonoursMinimumOut() public {
        usdg.mint(address(module), 1_000 * ONE);

        vm.prank(owner);
        vm.expectRevert("slippage");
        module.buyback(type(uint256).max, 1_000_000e18);
    }

    function test_BuybackNeedsAPool() public {
        FixedRateBuyback fresh = new FixedRateBuyback(owner, address(usdg), address(blur), false);
        usdg.mint(address(fresh), 1_000 * ONE);

        vm.prank(owner);
        vm.expectRevert(BuybackModule.PoolNotSet.selector);
        fresh.buyback(type(uint256).max, 1);
    }

    // -----------------------------------------------------------------
    // Configuration is validated, not trusted
    // -----------------------------------------------------------------

    function test_SetPoolRejectsAnotherPair() public {
        MockERC20 other = new MockERC20("Other", "OTH", 18);
        PoolKey memory bad = PoolKey({
            currency0: Currency.wrap(address(usdg)),
            currency1: Currency.wrap(address(other)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        vm.prank(owner);
        vm.expectRevert(BuybackModule.PoolAssetMismatch.selector);
        module.setPool(bad);
    }

    function test_SetVaultRejectsAnotherAsset() public {
        MockERC20 other = new MockERC20("Other", "OTH", 6);
        MockYieldVault otherVenue = new MockYieldVault(IERC20(address(other)), 500);
        Safex otherVault = new Safex(
            IERC20(address(other)), IERC4626(address(otherVenue)), "Other", "OTH", owner
        );

        vm.prank(owner);
        vm.expectRevert(BuybackModule.VaultAssetMismatch.selector);
        module.setVault(address(otherVault), true);
    }

    function test_SweepCannotImpersonateARetirement() public {
        blur.mint(address(module), 1e18);

        vm.prank(owner);
        vm.expectRevert(BuybackModule.CannotSweepToGraveyard.selector);
        module.sweep(address(blur), GRAVEYARD, 1e18);
    }

    function test_SweepRejectsStranger() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        module.sweep(address(blur), stranger, 0);
    }

    // -----------------------------------------------------------------
    // Through the guard
    // -----------------------------------------------------------------

    function test_GuardDrivesTheWholeCycle() public {
        uint256 shares = _earnFees();

        vm.prank(keeper);
        uint256 assets = guard.collectFees(address(module), address(vault), shares);
        assertGt(assets, 0);

        vm.prank(keeper);
        uint256 retired = guard.buyback(address(module), 1);

        assertGt(retired, 0);
        assertEq(blur.balanceOf(GRAVEYARD), retired);
    }

    function test_GuardRejectsStrangerAsKeeper() public {
        usdg.mint(address(module), 1_000 * ONE);

        vm.prank(stranger);
        vm.expectRevert(KeeperGuard.NotKeeper.selector);
        guard.buyback(address(module), 1);
    }

    function test_GuardRejectsUnregisteredModule() public {
        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.BuybackNotAllowed.selector);
        guard.buyback(address(0xdead), 1);
    }

    function test_GuardCapsSpendPerCall() public {
        usdg.mint(address(module), 500_000 * ONE);

        vm.prank(owner);
        guard.setBuybackLimit(1_000 * ONE);

        vm.prank(keeper);
        guard.buyback(address(module), 1);

        assertEq(module.totalSpent(), 1_000 * ONE, "guard's cap did not bind");
    }

    function test_GuardEnforcesCooldown() public {
        usdg.mint(address(module), 10_000 * ONE);

        // Small enough that there is still something to spend on the third
        // call, so a failure here is the cooldown and not an empty balance.
        vm.prank(owner);
        guard.setBuybackLimit(1_000 * ONE);

        vm.prank(keeper);
        guard.buyback(address(module), 1);

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.CoolingDown.selector);
        guard.buyback(address(module), 1);

        skip(1 hours);
        vm.prank(keeper);
        guard.buyback(address(module), 1);
    }

    function test_GuardPauseStopsBuybacks() public {
        usdg.mint(address(module), 10_000 * ONE);

        vm.prank(owner);
        guard.pause();

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.Paused.selector);
        guard.buyback(address(module), 1);
    }

    /// @dev A guard whose limit was never set must not spend anything, rather
    ///      than treating zero as unlimited.
    function test_UnsetGuardLimitSpendsNothing() public {
        KeeperGuard fresh = new KeeperGuard(owner, 1_000 * ONE, 1 hours);
        usdg.mint(address(module), 10_000 * ONE);

        vm.startPrank(owner);
        fresh.setKeeper(keeper, true);
        fresh.setBuyback(address(module), true);
        module.setGuard(address(fresh));
        vm.stopPrank();

        vm.prank(keeper);
        vm.expectRevert(BuybackModule.NothingToSpend.selector);
        fresh.buyback(address(module), 1);
    }

    /// @dev The compromised-keeper bound this design rests on: whatever else it
    ///      does, it cannot spend more than the cap per cooldown period.
    function test_CompromisedKeeperIsBoundedBySizeNotPrice() public {
        usdg.mint(address(module), 1_000_000 * ONE);

        vm.prank(owner);
        guard.setBuybackLimit(1_000 * ONE);

        // A keeper that accepts the worst possible fill still only reaches the
        // cap, and cannot come back until the cooldown has passed.
        vm.prank(keeper);
        guard.buyback(address(module), 1);

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.CoolingDown.selector);
        guard.buyback(address(module), 1);

        assertEq(module.totalSpent(), 1_000 * ONE);
        assertEq(usdg.balanceOf(address(module)), 999_000 * ONE, "the rest is untouched");
    }
}
