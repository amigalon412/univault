// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {BasketAdapterCore} from "../src/BasketAdapterCore.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20} from "./mocks/Mocks.sol";
import {MockAggregator} from "./PriceOracle.t.sol";

/// @dev A stock token: ordinary ERC-20 plus the split multiplier.
contract MockStock is MockERC20 {
    uint256 public multiplier = 1e18;

    constructor(string memory n, string memory s) MockERC20(n, s, 18) {}

    function uiMultiplier() external view returns (uint256) {
        return multiplier;
    }

    function burnFrom(address a, uint256 amount) external {
        _burn(a, amount);
    }

    function setMultiplier(uint256 m) external {
        multiplier = m;
    }

    function balanceOfUI(address a) external view returns (uint256) {
        return (balanceOf(a) * multiplier) / 1e18;
    }
}

contract BasketAdapterTest is Test {
    PriceOracle oracle;
    BasketAdapter basket;
    MockERC20 usdg;

    MockStock nvda;
    MockStock aapl;
    MockAggregator nvdaFeed;
    MockAggregator aaplFeed;

    address owner = makeAddr("owner");
    address vault = makeAddr("vault");
    address stranger = makeAddr("stranger");

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        oracle = new PriceOracle(owner);
        basket = new BasketAdapter(owner, oracle, vault, address(usdg), IPoolManager(address(0)));

        nvda = new MockStock("NVIDIA", "NVDA");
        aapl = new MockStock("Apple", "AAPL");
        nvdaFeed = new MockAggregator(8, "RHNVDA / USD", 200_00000000); // $200
        aaplFeed = new MockAggregator(8, "RHAAPL / USD", 300_00000000); // $300

        vm.startPrank(owner);
        oracle.setFeed(address(nvda), address(nvdaFeed), 2 hours);
        oracle.setFeed(address(aapl), address(aaplFeed), 2 hours);
        basket.addConstituent(address(nvda), 6_000);
        basket.addConstituent(address(aapl), 4_000);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // Valuation
    // ------------------------------------------------------------------

    function test_ValuesHoldingsFromTheOracle() public {
        nvda.mint(address(basket), 10e18); // 10 x $200 = $2,000
        aapl.mint(address(basket), 5e18); //  5 x $300 = $1,500

        assertEq(basket.valueOf(address(nvda)), 2_000e18);
        assertEq(basket.valueOf(address(aapl)), 1_500e18);
        assertEq(basket.totalValueUsd(), 3_500e18);
    }

    function test_EmptyBasketIsWorthNothingRatherThanReverting() public view {
        assertEq(basket.totalValueUsd(), 0);
    }

    function test_ValuationFollowsThePrice() public {
        nvda.mint(address(basket), 10e18);
        assertEq(basket.totalValueUsd(), 2_000e18);

        nvdaFeed.set(250_00000000, block.timestamp);
        assertEq(basket.totalValueUsd(), 2_500e18);
    }

    function test_StaleFeedStopsValuation() public {
        nvda.mint(address(basket), 10e18);

        nvdaFeed.set(200_00000000, block.timestamp - 3 hours);
        assertFalse(basket.isValuable(), "should report itself unvaluable");

        vm.expectRevert();
        basket.totalValueUsd();
    }

    // ------------------------------------------------------------------
    // Splits — the trap this contract exists to avoid
    // ------------------------------------------------------------------

    function test_SplitHaltsValuationUntilAcknowledged() public {
        nvda.mint(address(basket), 10e18);
        assertEq(basket.totalValueUsd(), 2_000e18);

        // A 2:1 split takes effect on its own schedule, with no call from us.
        nvda.setMultiplier(2e18);

        assertFalse(basket.isValuable(), "a moved multiplier must stop valuation");
        vm.expectRevert(
            abi.encodeWithSelector(BasketAdapterCore.MultiplierChanged.selector, address(nvda), 1e18, 2e18)
        );
        basket.totalValueUsd();
    }

    function test_AcknowledgingASplitResumesValuation() public {
        nvda.mint(address(basket), 10e18);
        nvda.setMultiplier(2e18);

        vm.prank(owner);
        basket.acknowledgeMultiplier(address(nvda));

        assertTrue(basket.isValuable());
        assertEq(basket.totalValueUsd(), 2_000e18, "raw balance and price are unchanged");
    }

    function test_OnlyOwnerCanAcknowledgeASplit() public {
        nvda.setMultiplier(2e18);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        basket.acknowledgeMultiplier(address(nvda));
    }

    /// @notice A split in one holding must not silently mask the others.
    function test_OneSplitStopsTheWholeBasket() public {
        nvda.mint(address(basket), 10e18);
        aapl.mint(address(basket), 5e18);

        aapl.setMultiplier(4e18);

        vm.expectRevert();
        basket.totalValueUsd();
        assertEq(basket.valueOf(address(nvda)), 2_000e18, "the untouched holding still prices");
    }

    // ------------------------------------------------------------------
    // Moving assets
    // ------------------------------------------------------------------

    function test_OnlyTheVaultCanPullAssets() public {
        nvda.mint(address(basket), 10e18);

        vm.prank(stranger);
        vm.expectRevert(BasketAdapterCore.NotVault.selector);
        basket.sendToVault(address(nvda), 1e18);

        vm.prank(owner);
        vm.expectRevert(BasketAdapterCore.NotVault.selector);
        basket.sendToVault(address(nvda), 1e18);
    }

    function test_AssetsCanOnlyGoToTheVault() public {
        nvda.mint(address(basket), 10e18);

        vm.prank(vault);
        basket.sendToVault(address(nvda), 4e18);

        assertEq(nvda.balanceOf(vault), 4e18);
        assertEq(nvda.balanceOf(address(basket)), 6e18);
    }

    function test_InKindSliceIsProRataAcrossEverything() public {
        nvda.mint(address(basket), 10e18);
        aapl.mint(address(basket), 5e18);

        // A quarter of the basket.
        vm.prank(vault);
        basket.sendSliceToVault(1, 4);

        assertEq(nvda.balanceOf(vault), 2.5e18);
        assertEq(aapl.balanceOf(vault), 1.25e18);
        assertEq(basket.totalValueUsd(), 2_625e18, "three quarters of $3,500 left");
    }

    /// @notice The exit that has to work on the worst day: prices stale, market
    ///         shut, a split pending. In-kind needs none of it.
    function test_InKindWorksWhenNothingCanBePriced() public {
        nvda.mint(address(basket), 10e18);
        aapl.mint(address(basket), 5e18);

        nvdaFeed.set(200_00000000, block.timestamp - 30 days);
        aaplFeed.set(300_00000000, block.timestamp - 30 days);
        nvda.setMultiplier(2e18);

        assertFalse(basket.isValuable(), "precondition: nothing is priceable");

        vm.prank(vault);
        basket.sendSliceToVault(1, 2);

        assertEq(nvda.balanceOf(vault), 5e18, "half the NVDA still came out");
        assertEq(aapl.balanceOf(vault), 2.5e18, "half the AAPL still came out");
    }

    // ------------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------------

    function test_WeightsCannotExceedOneHundredPercent() public {
        MockStock tsla = new MockStock("Tesla", "TSLA");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BasketAdapterCore.WeightsExceedTotal.selector, 10_500));
        basket.addConstituent(address(tsla), 500);
    }

    function test_CannotOrphanAPositionByRemovingItsToken() public {
        nvda.mint(address(basket), 10e18);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(BasketAdapterCore.StillHoldingBalance.selector, address(nvda), 10e18)
        );
        basket.removeConstituent(address(nvda));
    }

    function test_RemovingAnEmptyConstituentWorks() public {
        vm.prank(owner);
        basket.removeConstituent(address(nvda));

        assertEq(basket.tokensLength(), 1);
        vm.expectRevert(abi.encodeWithSelector(BasketAdapterCore.UnknownToken.selector, address(nvda)));
        basket.valueOf(address(nvda));
    }

    function test_UnknownTokenIsRejectedEverywhere() public {
        MockStock rogue = new MockStock("Rogue", "ROGUE");
        rogue.mint(address(basket), 1e18);

        vm.expectRevert(abi.encodeWithSelector(BasketAdapterCore.UnknownToken.selector, address(rogue)));
        basket.valueOf(address(rogue));

        // And an unregistered token cannot be pulled out either.
        vm.prank(vault);
        vm.expectRevert(abi.encodeWithSelector(BasketAdapterCore.UnknownToken.selector, address(rogue)));
        basket.sendToVault(address(rogue), 1e18);

        // So a donation cannot inflate the basket's reported value.
        assertEq(basket.totalValueUsd(), 0);
    }
}
