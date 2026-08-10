// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {Univault} from "../src/Univault.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";
import {MockAggregator} from "./PriceOracle.t.sol";
import {MockStock} from "./BasketAdapter.t.sol";

/// @dev An adapter that keeps what it is told to spend. Nothing exotic: it is a
///      BasketAdapter with one function overridden, which is what an owner
///      deploying their own adapter is free to do.
contract ThievingBasket is BasketAdapter {
    address public immutable thief;

    constructor(address owner_, PriceOracle oracle_, address vault_, address stable_, address thief_)
        BasketAdapter(owner_, oracle_, vault_, stable_, IPoolManager(address(0)))
    {
        thief = thief_;
    }

    function buy(address, uint256 stableIn, uint256) external override onlyVault returns (uint256) {
        IERC20(stable).transfer(thief, stableIn);
        return 0;
    }
}

/// @dev Stands in for a pool priced to suit whoever set it: the swap goes
///      through, it just returns almost nothing.
contract RiggedFillBasket is BasketAdapter {
    constructor(address o, PriceOracle p, address v, address s)
        BasketAdapter(o, p, v, s, IPoolManager(address(0)))
    {}

    function buy(address token, uint256 stableIn, uint256 minOut) external override onlyVault returns (uint256) {
        uint256 honest = (stableIn * 1e12 * 1e18) / oracle.priceUsd(token);
        uint256 out = honest / 1_000_000;
        require(out >= minOut, "slippage");
        MockStock(token).mint(address(this), out);
        return out;
    }
}

/// @dev Fills at exactly the oracle price, so the split is real without a venue.
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

/// @notice Findings from reviewing the contracts, each written as the smallest
///         thing that demonstrates it. A finding without a failing test is an
///         opinion.
contract SecurityTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    PriceOracle oracle;
    Univault vault;
    MockStock nvda;
    MockAggregator feed;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address thief = makeAddr("thief");

    uint256 constant ONE = 1e6;

    function setUp() public {
        vm.warp(1_700_000_000);

        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        oracle = new PriceOracle(owner);
        vault = new Univault(
            IERC20(address(usdg)), IERC4626(address(venue)), "Univault Balanced", "uvBAL", owner
        );

        nvda = new MockStock("NVIDIA", "NVDA");
        feed = new MockAggregator(8, "RHNVDA / USD", 200_00000000); // $200

        vm.startPrank(owner);
        oracle.setFeed(address(nvda), address(feed), 2 hours);
        vault.setAutoAllocate(false); // these tests drive allocation by hand
        vm.stopPrank();
    }

    function _deposit(uint256 amount) internal {
        usdg.mint(alice, amount);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(amount, alice);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // Finding 1 — the owner could move depositor assets to an address of
    // their choosing.
    //
    // `setBasket` accepted any address and `rebalance` handed that contract
    // the stable to trade with, so an owner could point the vault at an
    // adapter they wrote and keep the deposits. No pricing rule reaches it:
    // such an adapter ignores minAmountOut entirely.
    //
    // Closed by making the choice unrepeatable. These pin both halves of it.
    // -----------------------------------------------------------------

    function test_Finding1_ABasketCannotBeIntroducedAfterDeposits() public {
        _deposit(10_000 * ONE);

        ThievingBasket evil =
            new ThievingBasket(owner, oracle, address(vault), address(usdg), thief);

        vm.startPrank(owner);
        evil.addConstituent(address(nvda), 10_000);
        vm.expectRevert(Univault.VaultInUse.selector);
        vault.setBasket(evil, 0);
        vm.stopPrank();

        assertEq(usdg.balanceOf(thief), 0, "the drain went through");
        assertEq(vault.totalAssets(), 10_000 * ONE, "the vault kept its value");
    }

    function test_Finding1_AnHonestBasketCannotBeReplacedLater() public {
        PerfectFillBasket honest =
            new PerfectFillBasket(owner, oracle, address(vault), address(usdg));
        ThievingBasket evil =
            new ThievingBasket(owner, oracle, address(vault), address(usdg), thief);

        vm.startPrank(owner);
        honest.addConstituent(address(nvda), 10_000);
        vault.setBasket(honest, 6_000);

        evil.addConstituent(address(nvda), 10_000);
        vm.expectRevert(Univault.BasketAlreadySet.selector);
        vault.setBasket(evil, 0);
        vm.stopPrank();

        assertEq(address(vault.basket()), address(honest), "the basket moved");
    }

    /// @dev The adapter has to already point back at this vault, which catches
    ///      a misdeployment before it can hold anything.
    function test_ABasketBoundToAnotherVaultIsRefused() public {
        Univault other = new Univault(
            IERC20(address(usdg)), IERC4626(address(venue)), "Other", "OTH", owner
        );
        PerfectFillBasket foreign =
            new PerfectFillBasket(owner, oracle, address(other), address(usdg));

        vm.prank(owner);
        vm.expectRevert(Univault.BasketNotBound.selector);
        vault.setBasket(foreign, 6_000);
    }

    // -----------------------------------------------------------------
    // Finding 4 — an honest, fixed basket is not enough on its own.
    //
    // Even if `setBasket` were removed entirely, the owner sets the pool each
    // constituent trades through, and `rebalance` used to let its caller name
    // any slippage at all. At 100% the floor is zero, so a trade routed through
    // a pool priced to suit handed almost everything away and passed every
    // check. Fixed with a constant ceiling the owner cannot raise; this pins it.
    // -----------------------------------------------------------------

    function test_Finding4_SlippageCannotBeWidenedToNothing() public {
        RiggedFillBasket basket =
            new RiggedFillBasket(owner, oracle, address(vault), address(usdg));

        vm.startPrank(owner);
        basket.addConstituent(address(nvda), 10_000);
        vault.setBasket(basket, 0); // everything into stocks
        vm.stopPrank();

        _deposit(10_000 * ONE);

        // Naming a slippage that would make the oracle price optional is now
        // rejected outright, by the owner as much as by anyone else.
        vm.prank(owner);
        vm.expectRevert(Univault.SlippageOutOfRange.selector);
        vault.rebalance(address(nvda), type(uint256).max, 10_000);

        // And at the widest the vault does allow, a fill worth a millionth of
        // the oracle price is refused by the slippage floor instead.
        vm.prank(owner);
        vm.expectRevert("slippage");
        vault.rebalance(address(nvda), type(uint256).max, 1_000);

        assertEq(vault.totalAssets(), 10_000 * ONE, "the vault kept its value");
    }

    // -----------------------------------------------------------------
    // Finding 2 — maxWithdraw promised more than the vault could pay.
    //
    // It reported the holder's whole position while only the lending leg can
    // fund a priced exit, so an integrator following ERC-4626 would have had a
    // reverting withdrawal. Fixed by capping both limits at the stable leg;
    // this now pins the fix.
    // -----------------------------------------------------------------

    function test_Finding2_MaxWithdrawIsCappedAtTheStableLeg() public {
        PerfectFillBasket basket =
            new PerfectFillBasket(owner, oracle, address(vault), address(usdg));

        vm.startPrank(owner);
        basket.addConstituent(address(nvda), 10_000);
        vault.setBasket(basket, 6_000); // 60% stable, 40% stocks
        vm.stopPrank();

        _deposit(10_000 * ONE);

        vm.prank(owner);
        vault.rebalance(address(nvda), type(uint256).max, 100);

        // Four thousand dollars of the vault is now stock, and the vault has no
        // path that sells stock to fund a withdrawal.
        assertApproxEqAbs(vault.basketAssets(), 4_000 * ONE, 1 * ONE, "split did not happen");

        uint256 promised = vault.maxWithdraw(alice);
        uint256 position = vault.convertToAssets(vault.balanceOf(alice));

        assertApproxEqAbs(promised, 6_000 * ONE, 1 * ONE, "should be capped at the stable leg");
        assertLt(promised, position, "the cap has to actually bind");

        // ERC-4626 requires maxWithdraw to name an amount that would not revert.
        vm.prank(alice);
        vault.withdraw(promised, alice, alice);

        // And one dollar past it does revert, which is why the cap is needed.
        vm.prank(alice);
        vm.expectRevert();
        vault.withdraw(1 * ONE, alice, alice);

        // The in-kind path is the one that actually works, and it is not what
        // an integrator reading maxWithdraw would reach for.
        uint256 remaining = vault.balanceOf(alice); // hoisted: an argument
        vm.prank(alice); // expression would otherwise consume the prank
        vault.redeemInKind(remaining, alice, alice);
        assertEq(vault.balanceOf(alice), 0);
        assertGt(nvda.balanceOf(alice), 0, "paid in kind");
    }

    // -----------------------------------------------------------------
    // Finding 3 — stable stranded in the adapter is invisible and stuck.
    // -----------------------------------------------------------------

    function test_Finding3_StableSentToTheAdapterIsLost() public {
        PerfectFillBasket basket =
            new PerfectFillBasket(owner, oracle, address(vault), address(usdg));

        vm.startPrank(owner);
        basket.addConstituent(address(nvda), 10_000);
        vault.setBasket(basket, 6_000);
        vm.stopPrank();

        _deposit(10_000 * ONE);
        uint256 before = vault.totalAssets();

        // However it gets there -- a donation, a partial fill, a mistaken
        // transfer -- stable in the adapter is counted by nobody.
        usdg.mint(address(basket), 1_000 * ONE);

        assertEq(vault.totalAssets(), before, "adapter stable is invisible to the vault");

        // The adapter's own sweep is onlyVault, so it can never be called
        // directly -- which is what made the recovery path it documents
        // unreachable until the vault grew a function that calls it.
        vm.prank(owner);
        vm.expectRevert(BasketAdapter.NotVault.selector);
        basket.sweepStableToVault();

        vm.prank(owner);
        uint256 swept = vault.sweepBasketStable();

        assertEq(swept, 1_000 * ONE, "sweep returned nothing");
        assertEq(vault.totalAssets(), before + 1_000 * ONE, "value did not come back");
        assertEq(usdg.balanceOf(address(basket)), 0, "adapter still holding stable");
    }
}
