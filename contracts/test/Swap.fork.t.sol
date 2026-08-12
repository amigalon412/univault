// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Safex} from "../src/Safex.sol";
import {BasketAdapter} from "../src/BasketAdapter.sol";
import {BasketAdapterCore} from "../src/BasketAdapterCore.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {SwapExecutor} from "../src/SwapExecutor.sol";
import {RobinhoodChain} from "../src/RobinhoodChain.sol";

/// @notice A real swap, in the real USDG/NVDA pool, on a fork.
///
/// @dev The pool was found by reading Initialize logs off the PoolManager and
///      ranking the results by liquidity from StateView. 204 pools list NVDA;
///      this is the one with essentially all of the depth.
contract SwapForkTest is Test {
    IPoolManager constant POOL_MANAGER = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    IERC20 constant usdg = IERC20(RobinhoodChain.USDG);
    IERC20 constant nvda = IERC20(RobinhoodChain.NVDA);

    PriceOracle oracle;
    Safex vault;
    BasketAdapter basket;

    address owner = makeAddr("owner");
    uint256 constant ONE = 1e6;

    function setUp() public {
        vm.createSelectFork(vm.envOr("ROBINHOOD_RPC", vm.rpcUrl("robinhood")));

        oracle = new PriceOracle(owner);
        vault = new Safex(
            usdg, IERC4626(RobinhoodChain.STEAK_USDG), "Safex Balanced", "uvBAL", owner
        );
        basket = new BasketAdapter(owner, oracle, address(vault), address(usdg), POOL_MANAGER);

        vm.startPrank(owner);
        oracle.setFeed(RobinhoodChain.NVDA, RobinhoodChain.NVDA_USD_FEED, 24 hours);
        basket.addConstituent(RobinhoodChain.NVDA, 10_000);
        basket.setPool(RobinhoodChain.NVDA, _nvdaPool());
        vault.setBasket(basket, 6_000);
        vault.setAutoAllocate(false); // these tests drive swaps by hand
        vm.stopPrank();
    }

    /// @dev USDG/NVDA, 0.30%, tick spacing 60, no hooks.
    function _nvdaPool() internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(RobinhoodChain.USDG),
            currency1: Currency.wrap(RobinhoodChain.NVDA),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    // ------------------------------------------------------------------

    function test_BuysNvdaWithUsdg() public {
        uint256 spend = 5_000 * ONE;
        deal(address(usdg), address(basket), spend);

        uint256 expected = (spend * 1e18) / (oracle.priceUsd(RobinhoodChain.NVDA) / 1e12);

        vm.prank(address(vault));
        uint256 received = basket.buy(RobinhoodChain.NVDA, spend, 0);

        console2.log("spent USDG      :", spend / ONE);
        console2.log("received NVDA   :", received);
        console2.log("oracle-implied  :", expected);

        assertGt(received, 0, "swap produced nothing");
        assertEq(nvda.balanceOf(address(basket)), received, "tokens did not land in the basket");
        assertEq(usdg.balanceOf(address(basket)), 0, "stablecoin was not fully spent");

        // Within 5% of what the oracle implies. Wider than a good fill, tight
        // enough to catch a wrong pool or an inverted direction.
        assertApproxEqRel(received, expected, 5e16, "fill is nowhere near the oracle price");
    }

    function test_SellsNvdaBackToTheVault() public {
        uint256 spend = 5_000 * ONE;
        deal(address(usdg), address(basket), spend);

        vm.prank(address(vault));
        uint256 bought = basket.buy(RobinhoodChain.NVDA, spend, 0);

        uint256 vaultBefore = usdg.balanceOf(address(vault));
        vm.prank(address(vault));
        uint256 stableOut = basket.sell(RobinhoodChain.NVDA, bought, 0);

        console2.log("round-tripped USDG:", stableOut / ONE);
        assertEq(usdg.balanceOf(address(vault)) - vaultBefore, stableOut, "proceeds did not reach the vault");
        assertEq(nvda.balanceOf(address(basket)), 0, "position not fully sold");

        // Two 0.30% fees plus spread, so a round trip must lose a little and
        // must never gain. Anything else means the accounting is wrong.
        assertLt(stableOut, spend, "round trip created value out of nothing");
        assertGt(stableOut, (spend * 95) / 100, "lost more than fees and spread explain");
    }

    function test_SlippageGuardStopsABadFill() public {
        uint256 spend = 5_000 * ONE;
        deal(address(usdg), address(basket), spend);

        // Demand far more than the pool can give.
        vm.prank(address(vault));
        vm.expectRevert();
        basket.buy(RobinhoodChain.NVDA, spend, 1_000_000e18);
    }

    function test_OnlyTheVaultCanTrade() public {
        deal(address(usdg), address(basket), 1_000 * ONE);

        vm.prank(owner);
        vm.expectRevert(BasketAdapterCore.NotVault.selector);
        basket.buy(RobinhoodChain.NVDA, 1_000 * ONE, 0);
    }

    function test_UnlockCallbackRejectsStrangers() public {
        vm.expectRevert(SwapExecutor.NotPoolManager.selector);
        basket.unlockCallback("");
    }

    function test_BoughtPositionIsValuedByTheOracle() public {
        uint256 spend = 5_000 * ONE;
        deal(address(usdg), address(basket), spend);

        vm.prank(address(vault));
        basket.buy(RobinhoodChain.NVDA, spend, 0);

        uint256 valued = vault.basketAssets();
        console2.log("basket valued at USDG:", valued / ONE);

        // Bought at the pool price, marked at the oracle price: close, not equal.
        assertApproxEqRel(valued, spend, 6e16, "valuation and cost are too far apart");
    }
}
