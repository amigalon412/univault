// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {Safex} from "../src/Safex.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";
import {MockAggregator} from "./PriceOracle.t.sol";
import {MockStock} from "./BasketAdapter.t.sol";
import {PerfectFillBasket} from "./Rebalance.t.sol";

/// @dev A basket that fills every name perfectly except one, whose pool is
///      dead and always reverts — the case the deposit's best-effort path has
///      to survive. Sells are unused here.
contract OneDeadPoolBasket is BasketAdapter {
    address public immutable dead;

    constructor(address o, PriceOracle p, address v, address s, address dead_)
        BasketAdapter(o, p, v, s, IPoolManager(address(0)))
    {
        dead = dead_;
    }

    function buy(address token, uint256 stableIn, uint256 minOut) external override onlyVault returns (uint256) {
        if (token == dead) revert("dead pool");
        uint256 out = (stableIn * 1e12 * 1e18) / oracle.priceUsd(token);
        require(out >= minOut, "slippage");
        IERC20(stable).transfer(address(0xdead), stableIn); // consume the stable, as a real swap would
        MockStock(token).mint(address(this), out);
        return out;
    }
}

/// @notice A deposit puts its own money to work in the same transaction: it
///         buys the basket toward target weights and lends the rest, all on the
///         depositor's gas. These tests pin that behaviour down.
contract AllocateOnDepositTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    PriceOracle oracle;
    Safex vault;
    PerfectFillBasket basket;

    MockStock nvda;
    MockStock aapl;
    MockStock tsla;
    MockStock amzn;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    uint256 constant ONE = 1e6; // USDG has 6 decimals
    uint16 constant BALANCED = 6_000; // 60 stable / 40 equity
    uint16 constant BUFFER = 500; // 5% kept idle (the vault's default)

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        oracle = new PriceOracle(owner);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex Balanced", "uvBAL", owner);
        basket = new PerfectFillBasket(owner, oracle, address(vault), address(usdg));

        nvda = new MockStock("NVIDIA", "NVDA");
        aapl = new MockStock("Apple", "AAPL");
        tsla = new MockStock("Tesla", "TSLA");
        amzn = new MockStock("Amazon", "AMZN");

        vm.startPrank(owner);
        _list(nvda, 200_00000000); // $200
        _list(aapl, 150_00000000); // $150
        _list(tsla, 300_00000000); // $300
        _list(amzn, 175_00000000); // $175
        vault.setBasket(basket, BALANCED); // autoAllocate ships on
        vm.stopPrank();

        usdg.mint(alice, 10_000_000 * ONE);
        vm.prank(alice);
        usdg.approve(address(vault), type(uint256).max);
    }

    function _list(MockStock token, int256 priceE8) internal {
        MockAggregator feed = new MockAggregator(8, "STOCK / USD", priceE8);
        oracle.setFeed(address(token), address(feed), 2 hours);
        basket.addConstituent(address(token), 2_500); // four names, evenly weighted
    }

    function _deposit(uint256 amount) internal {
        vm.prank(alice);
        vault.deposit(amount, alice);
    }

    // ------------------------------------------------------------------

    function test_FreshDepositLandsOnTargetSplit() public {
        _deposit(100_000 * ONE);

        assertEq(vault.currentStableBps(), BALANCED, "deposit did not land on target");
        assertFalse(vault.needsRebalance(), "a fresh deposit should need no rebalance");
        assertApproxEqAbs(vault.basketAssets(), 40_000 * ONE, 4, "equity leg is not 40%");
    }

    function test_EquityIsSpreadEvenlyAcrossAllFour() public {
        _deposit(100_000 * ONE);

        // 40% equity, split four ways -> 10% of the deposit in each name.
        uint256 each = 10_000 * ONE;
        assertApproxEqAbs(_valueInAssets(nvda), each, 2, "NVDA off target");
        assertApproxEqAbs(_valueInAssets(aapl), each, 2, "AAPL off target");
        assertApproxEqAbs(_valueInAssets(tsla), each, 2, "TSLA off target");
        assertApproxEqAbs(_valueInAssets(amzn), each, 2, "AMZN off target");
    }

    function test_StableAboveBufferIsLent() public {
        _deposit(100_000 * ONE);

        // Stable leg is 60% = 60k. Buffer keeps 5% of total (5k) idle; the rest
        // earns yield in the venue.
        uint256 idle = usdg.balanceOf(address(vault));
        uint256 lent = venue.convertToAssets(venue.balanceOf(address(vault)));
        assertApproxEqAbs(idle, 5_000 * ONE, 2, "buffer not kept idle");
        assertApproxEqAbs(lent, 55_000 * ONE, 4, "surplus stable not lent");
    }

    function test_SecondDepositKeepsTheSplitOnTarget() public {
        _deposit(100_000 * ONE);
        _deposit(50_000 * ONE);

        assertApproxEqAbs(vault.currentStableBps(), BALANCED, 2, "second deposit drifted the split");
        assertApproxEqAbs(vault.basketAssets(), 60_000 * ONE, 6, "equity leg not 40% of the total");
        // Still even across the four after a top-up.
        assertApproxEqAbs(_valueInAssets(nvda), 15_000 * ONE, 3, "NVDA off after top-up");
        assertApproxEqAbs(_valueInAssets(amzn), 15_000 * ONE, 3, "AMZN off after top-up");
    }

    function test_BestEffortSkipsADeadPoolWithoutRevertingTheDeposit() public {
        // A basket is bound to its vault, so the dead-pool case needs its own
        // vault and its own basket built against it.
        Safex v2 = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex B2", "uvB2", owner);
        OneDeadPoolBasket bad = new OneDeadPoolBasket(owner, oracle, address(v2), address(usdg), address(tsla));
        vm.startPrank(owner);
        bad.addConstituent(address(nvda), 2_500);
        bad.addConstituent(address(aapl), 2_500);
        bad.addConstituent(address(tsla), 2_500);
        bad.addConstituent(address(amzn), 2_500);
        v2.setBasket(bad, BALANCED);
        vm.stopPrank();

        usdg.mint(alice, 100_000 * ONE);
        vm.startPrank(alice);
        usdg.approve(address(v2), type(uint256).max);
        v2.deposit(100_000 * ONE, alice); // must not revert
        vm.stopPrank();

        // The three live names filled; the dead one was skipped and left as
        // stable, so nothing is stranded in the basket.
        assertGt(IERC20(address(nvda)).balanceOf(address(bad)), 0, "NVDA did not fill");
        assertGt(IERC20(address(aapl)).balanceOf(address(bad)), 0, "AAPL did not fill");
        assertGt(IERC20(address(amzn)).balanceOf(address(bad)), 0, "AMZN did not fill");
        assertEq(IERC20(address(tsla)).balanceOf(address(bad)), 0, "dead name should hold nothing");
        assertEq(usdg.balanceOf(address(bad)), 0, "stable stranded in the basket");
    }

    function test_AutoAllocateOffLeavesDepositAllStable() public {
        vm.prank(owner);
        vault.setAutoAllocate(false);

        _deposit(100_000 * ONE);

        assertEq(vault.currentStableBps(), 10_000, "should be all stable with allocation off");
        assertEq(vault.basketAssets(), 0, "nothing should have been bought");
        assertTrue(vault.needsRebalance(), "a keeper is needed when allocation is off");
    }

    function test_SlippageBoundIsOwnerOnlyAndCapped() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setDepositSlippageBps(50);

        vm.prank(owner);
        vm.expectRevert(); // above MAX_SLIPPAGE_BPS (1_000)
        vault.setDepositSlippageBps(1_500);

        vm.prank(owner);
        vault.setDepositSlippageBps(300);
        assertEq(vault.depositSlippageBps(), 300);
    }

    function _valueInAssets(MockStock token) internal view returns (uint256) {
        // basket.valueOf is USD scaled to 1e18; USDG has 6 decimals.
        return basket.valueOf(address(token)) / 1e12;
    }
}
