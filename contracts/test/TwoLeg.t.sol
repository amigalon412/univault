// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";
import {MockAggregator} from "./PriceOracle.t.sol";
import {MockStock} from "./BasketAdapter.t.sol";

/// @notice The vault with both legs attached.
contract TwoLegTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    PriceOracle oracle;
    Safex vault;
    BasketAdapter basket;

    MockStock nvda;
    MockAggregator nvdaFeed;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE = 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        oracle = new PriceOracle(owner);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex Balanced", "uvBAL", owner);
        basket = new BasketAdapter(owner, oracle, address(vault), address(usdg), IPoolManager(address(0)));

        nvda = new MockStock("NVIDIA", "NVDA");
        nvdaFeed = new MockAggregator(8, "RHNVDA / USD", 200_00000000); // $200

        vm.startPrank(owner);
        oracle.setFeed(address(nvda), address(nvdaFeed), 2 hours);
        basket.addConstituent(address(nvda), 10_000);
        vault.setBasket(basket, 6_000); // BALANCED: 60 stable / 40 equity
        vault.setAutoAllocate(false); // these tests drive allocation by hand
        vm.stopPrank();

        usdg.mint(alice, 1_000_000 * ONE);
        usdg.mint(bob, 1_000_000 * ONE);
        vm.prank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdg.approve(address(vault), type(uint256).max);
    }

    /// @dev Simulates the equity leg having been bought: stablecoin left the
    ///      vault, stock arrived in the basket. Swaps come later; the
    ///      accounting has to be right first.
    function _moveToBasket(uint256 usdgAmount, uint256 stockAmount) internal {
        vm.prank(address(vault));
        usdg.transfer(address(0xdead), usdgAmount);
        nvda.mint(address(basket), stockAmount);
    }

    // ------------------------------------------------------------------
    // Valuation across both legs
    // ------------------------------------------------------------------

    function test_TotalAssetsCountsBothLegs() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);

        // Spend 40,000 USDG on 200 NVDA at $200.
        _moveToBasket(40_000 * ONE, 200e18);

        assertEq(vault.stableAssets(), 60_000 * ONE, "stable leg");
        assertEq(vault.basketAssets(), 40_000 * ONE, "equity leg");
        assertEq(vault.totalAssets(), 100_000 * ONE, "total unchanged by the swap");
        assertEq(vault.currentStableBps(), 6_000, "should be sitting on target");
    }

    function test_EquityMoveShowsUpInTheSharePrice() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _moveToBasket(40_000 * ONE, 200e18);

        uint256 priceBefore = vault.sharePrice();

        nvdaFeed.set(250_00000000, block.timestamp); // NVDA +25%

        assertEq(vault.basketAssets(), 50_000 * ONE, "basket did not reprice");
        assertGt(vault.sharePrice(), priceBefore, "gain did not reach holders");
        assertEq(vault.currentStableBps(), 5_454, "weights drifted, as they should");
    }

    function test_DriftAwayFromTargetIsVisible() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _moveToBasket(40_000 * ONE, 200e18);

        nvdaFeed.set(100_00000000, block.timestamp); // NVDA halves
        assertEq(vault.basketAssets(), 20_000 * ONE);
        assertEq(vault.currentStableBps(), 7_500, "equity leg shrank, stable share grew");
    }

    // ------------------------------------------------------------------
    // Refusing to price
    // ------------------------------------------------------------------

    function test_UnpriceableBasketBlocksDepositsAndPricedExits() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _moveToBasket(40_000 * ONE, 200e18);

        nvdaFeed.set(200_00000000, block.timestamp - 3 hours); // stale
        assertFalse(vault.isPriceable());

        vm.prank(bob);
        vm.expectRevert();
        vault.deposit(1_000 * ONE, bob);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        vault.redeem(shares, alice, alice);
    }

    /// @notice The whole point of the in-kind path.
    function test_InKindExitWorksWhenNothingCanBePriced() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _moveToBasket(40_000 * ONE, 200e18);

        // Everything that could go wrong, at once.
        nvdaFeed.set(200_00000000, block.timestamp - 30 days);
        nvda.setMultiplier(2e18);
        assertFalse(vault.isPriceable());

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        (uint256 stableOut,, uint256[] memory amounts) = vault.redeemInKind(shares, alice, alice);

        assertEq(stableOut, 60_000 * ONE, "did not receive the stable slice");
        assertEq(amounts[0], 200e18, "did not receive the equity slice");
        assertEq(nvda.balanceOf(alice), 200e18);
        assertEq(vault.balanceOf(alice), 0, "shares not burned");
    }

    function test_InKindExitIsProRataForPartialHolders() public {
        vm.prank(alice);
        vault.deposit(60_000 * ONE, alice);
        vm.prank(bob);
        vault.deposit(40_000 * ONE, bob);
        _moveToBasket(40_000 * ONE, 200e18);

        // Alice owns 60% and takes half of her position: 30% of the vault.
        uint256 half = vault.balanceOf(alice) / 2;
        vm.prank(alice);
        (uint256 stableOut,, uint256[] memory amounts) = vault.redeemInKind(half, alice, alice);

        assertApproxEqRel(stableOut, 18_000 * ONE, 1e15, "30% of the 60,000 stable leg");
        assertApproxEqRel(amounts[0], 60e18, 1e15, "30% of the 200 NVDA");
    }

    function test_InKindRespectsAllowances() public {
        vm.prank(alice);
        vault.deposit(50_000 * ONE, alice);
        uint256 shares = vault.balanceOf(alice);

        vm.prank(bob);
        vm.expectRevert();
        vault.redeemInKind(shares, bob, alice);

        vm.prank(alice);
        vault.approve(bob, shares);
        vm.prank(bob);
        vault.redeemInKind(shares, bob, alice);

        assertGt(usdg.balanceOf(bob), 1_000_000 * ONE - 1, "bob did not receive the redemption");
    }

    // ------------------------------------------------------------------
    // Attaching and detaching
    // ------------------------------------------------------------------

    /// @dev The basket is chosen once and never again. Substituting it was the
    ///      whole of the owner drain, so this is refused outright rather than
    ///      only while a position is open.
    function test_BasketCannotBeSwappedOut() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _moveToBasket(40_000 * ONE, 200e18);

        BasketAdapter other = new BasketAdapter(owner, oracle, address(vault), address(usdg), IPoolManager(address(0)));
        vm.prank(owner);
        vm.expectRevert(Safex.BasketAlreadySet.selector);
        vault.setBasket(other, 6_000);
    }

    /// @dev And an empty vault whose basket is already set is refused too, so
    ///      emptying it first is not a way back in.
    function test_BasketCannotBeSwappedOutEvenWhenEmpty() public {
        BasketAdapter other = new BasketAdapter(owner, oracle, address(vault), address(usdg), IPoolManager(address(0)));
        vm.prank(owner);
        vm.expectRevert(Safex.BasketAlreadySet.selector);
        vault.setBasket(other, 6_000);
    }

    function test_LendingOnlyVaultIsUnaffected() public {
        Safex steady =
            new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex Steady", "sfxSTEADY", owner);

        assertEq(steady.targetStableBps(), 10_000, "a fresh vault is lending-only");
        assertEq(steady.basketAssets(), 0);
        assertTrue(steady.isPriceable(), "no basket means nothing can be unpriceable");

        vm.startPrank(alice);
        usdg.approve(address(steady), type(uint256).max);
        steady.deposit(10_000 * ONE, alice);
        vm.stopPrank();
        assertEq(steady.totalAssets(), 10_000 * ONE);
    }

    function test_TargetSplitIsBounded() public {
        vm.prank(owner);
        vm.expectRevert(Safex.SplitOutOfRange.selector);
        vault.setTargetStableBps(10_001);
    }
}
