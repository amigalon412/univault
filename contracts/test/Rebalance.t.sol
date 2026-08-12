// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Safex} from "../src/Safex.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";
import {MockAggregator} from "./PriceOracle.t.sol";
import {MockStock} from "./BasketAdapter.t.sol";

/// @dev A basket whose swaps settle at exactly the oracle price. It removes the
///      venue from the picture so these tests measure the rebalance decision —
///      direction, size, the band — rather than a fill.
contract PerfectFillBasket is BasketAdapter {
    constructor(address o, PriceOracle p, address v, address s)
        BasketAdapter(o, p, v, s, IPoolManager(address(0)))
    {}

    function buy(address token, uint256 stableIn, uint256 minOut) external override onlyVault returns (uint256) {
        uint256 out = (stableIn * 1e12 * 1e18) / oracle.priceUsd(token);
        require(out >= minOut, "slippage");
        MockStock(token).mint(address(this), out);
        return out;
    }

    function sell(address token, uint256 amountIn, uint256 minOut) external override onlyVault returns (uint256) {
        uint256 out = (oracle.priceUsd(token) * amountIn) / 1e18 / 1e12;
        require(out >= minOut, "slippage");
        MockStock(token).burnFrom(address(this), amountIn);
        MockERC20(stable).mint(vault, out);
        return out;
    }
}

contract RebalanceTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    PriceOracle oracle;
    Safex vault;
    PerfectFillBasket basket;
    MockStock nvda;
    MockAggregator feed;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address alice = makeAddr("alice");

    uint256 constant ONE = 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        oracle = new PriceOracle(owner);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex Balanced", "uvBAL", owner);
        basket = new PerfectFillBasket(owner, oracle, address(vault), address(usdg));

        nvda = new MockStock("NVIDIA", "NVDA");
        feed = new MockAggregator(8, "RHNVDA / USD", 200_00000000); // $200

        vm.startPrank(owner);
        oracle.setFeed(address(nvda), address(feed), 2 hours);
        basket.addConstituent(address(nvda), 10_000);
        vault.setBasket(basket, 6_000); // 60 stable / 40 equity
        vault.setGuard(keeper); // keeper drives automation directly here
        vault.setAutoAllocate(false); // these tests drive allocation by hand
        vm.stopPrank();

        usdg.mint(alice, 1_000_000 * ONE);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(100_000 * ONE, alice);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------

    function test_FreshDepositIsAllStableAndNeedsRebalancing() public view {
        assertEq(vault.currentStableBps(), 10_000, "everything starts in the stable leg");
        assertTrue(vault.needsRebalance());
        assertEq(vault.driftBps(), 4_000, "40% over-weight stablecoin");
    }

    function test_RebalanceBuysEquityUpToTarget() public {
        vm.prank(keeper);
        uint256 traded = vault.rebalance(address(nvda), type(uint256).max, 100);

        assertEq(traded, 40_000 * ONE, "should have bought exactly the gap");
        assertEq(vault.currentStableBps(), 6_000, "did not land on target");
        assertEq(vault.basketAssets(), 40_000 * ONE);
        assertFalse(vault.needsRebalance(), "still out of band after rebalancing");
    }

    function test_SizeCapLimitsTheTradeWithoutOvershooting() public {
        vm.prank(keeper);
        uint256 traded = vault.rebalance(address(nvda), 10_000 * ONE, 100);

        assertEq(traded, 10_000 * ONE, "cap was not respected");
        assertEq(vault.currentStableBps(), 9_000, "moved toward target, not past it");
        assertTrue(vault.needsRebalance(), "still work to do");
    }

    function test_AskingForMoreThanTheGapJustClosesTheGap() public {
        vm.prank(keeper);
        vault.rebalance(address(nvda), 10_000_000 * ONE, 100);
        assertEq(vault.currentStableBps(), 6_000, "overshot the target");
    }

    function test_RebalanceSellsWhenEquityRuns() public {
        vm.prank(keeper);
        vault.rebalance(address(nvda), type(uint256).max, 100);

        // NVDA doubles: equity leg is now 80,000 of a 140,000 vault.
        feed.set(400_00000000, block.timestamp);
        assertEq(vault.currentStableBps(), 4_285, "drifted, as expected");
        assertTrue(vault.needsRebalance());

        vm.prank(keeper);
        uint256 traded = vault.rebalance(address(nvda), type(uint256).max, 100);

        assertGt(traded, 0, "nothing was sold");
        assertApproxEqAbs(vault.currentStableBps(), 6_000, 1, "did not return to target");
    }

    // ------------------------------------------------------------------
    // The band
    // ------------------------------------------------------------------

    function test_NothingHappensInsideTheBand() public {
        vm.prank(keeper);
        vault.rebalance(address(nvda), type(uint256).max, 100);

        // A 1% move, inside the 2% band.
        feed.set(202_50000000, block.timestamp);
        assertFalse(vault.needsRebalance());

        vm.prank(keeper);
        vm.expectRevert(Safex.WithinBand.selector);
        vault.rebalance(address(nvda), type(uint256).max, 100);
    }

    /// @notice A keeper must not be able to churn the vault at the target.
    function test_KeeperCannotGrindTheVaultAtTarget() public {
        vm.prank(keeper);
        vault.rebalance(address(nvda), type(uint256).max, 100);

        uint256 priceBefore = vault.sharePrice();
        for (uint256 i; i < 50; ++i) {
            vm.prank(keeper);
            vm.expectRevert(Safex.WithinBand.selector);
            vault.rebalance(address(nvda), type(uint256).max, 100);
        }
        assertEq(vault.sharePrice(), priceBefore, "grinding cost holders value");
    }

    // ------------------------------------------------------------------
    // Bounds
    // ------------------------------------------------------------------

    function test_OnlyAutomationOrOwnerCanRebalance() public {
        vm.prank(alice);
        vm.expectRevert(Safex.NotAutomation.selector);
        vault.rebalance(address(nvda), type(uint256).max, 100);
    }

    function test_SlippageIsBounded() public {
        vm.prank(keeper);
        vm.expectRevert(Safex.SlippageOutOfRange.selector);
        vault.rebalance(address(nvda), type(uint256).max, 10_001);
    }

    function test_UnpriceableVaultCannotBeRebalanced() public {
        feed.set(200_00000000, block.timestamp - 3 hours);
        assertFalse(vault.needsRebalance(), "must not ask for a trade it cannot price");

        vm.prank(keeper);
        vm.expectRevert();
        vault.rebalance(address(nvda), type(uint256).max, 100);
    }

    function test_RebalancingDoesNotChangeTotalValue() public {
        uint256 before = vault.totalAssets();
        vm.prank(keeper);
        vault.rebalance(address(nvda), type(uint256).max, 100);

        // A perfect fill only moves value between legs; it does not create it.
        assertApproxEqAbs(vault.totalAssets(), before, 2, "value appeared or vanished");
        assertEq(vault.balanceOf(alice), 100_000 * 1e12, "holder's shares moved");
    }

    function test_LendingOnlyVaultRefusesToRebalance() public {
        Safex steady =
            new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex Steady", "s", owner);
        vm.prank(owner);
        vm.expectRevert(Safex.NoBasket.selector);
        steady.rebalance(address(nvda), 1, 100);
    }
}
