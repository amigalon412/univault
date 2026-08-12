// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {ExitRouter} from "../src/ExitRouter.sol";
import {ExitRouterCore} from "../src/ExitRouterCore.sol";
import {SwapExecutor} from "../src/SwapExecutor.sol";
import {MockERC20} from "./mocks/Mocks.sol";

/// @dev ExitRouter with the venue swapped for a deterministic fill, so the test
///      measures the router's own logic — redeem in kind, aggregate, enforce the
///      floor — rather than a live pool. The real swap is covered by SwapExecutor
///      and the fork tests.
contract StubExitRouter is ExitRouter {
    MockERC20 public immutable usdg;

    constructor(MockERC20 usdg_) ExitRouter(IPoolManager(address(0))) {
        usdg = usdg_;
    }

    /// @dev The fee tier of each pool the router actually asked for, in order.
    ///      Recorded because which pool it picks is the thing worth checking:
    ///      the router used to derive that from a constant.
    uint24[] public feesSeen;

    /// @dev Fills at exactly $1 per whole stock token: 18-dec in, 6-dec USDG out.
    function _executeSwap(SwapRequest memory req) internal override returns (uint256 amountOut) {
        feesSeen.push(req.key.fee);
        amountOut = req.amountIn / 1e12;
        usdg.mint(address(this), amountOut);
    }

    function feesSeenLength() external view returns (uint256) {
        return feesSeen.length;
    }
}

/// @dev Stands in for BasketAdapter's `poolKeys` mapping. The fee tier is per
///      token on purpose: the basket is not uniform, and that is exactly what
///      the router got wrong before it started reading this.
contract MockExitBasket {
    struct Pool {
        Currency currency0;
        Currency currency1;
        uint24 fee;
        int24 tickSpacing;
        IHooks hooks;
    }

    mapping(address => Pool) internal _pools;

    function setPool(address token, address stable, uint24 fee, int24 tickSpacing) external {
        (address c0, address c1) = token < stable ? (token, stable) : (stable, token);
        _pools[token] = Pool({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(address(0))
        });
    }

    function poolKeys(address token) external view returns (Currency, Currency, uint24, int24, IHooks) {
        Pool memory p = _pools[token];
        return (p.currency0, p.currency1, p.fee, p.tickSpacing, p.hooks);
    }
}

/// @dev Stands in for a Safex redeemInKind: hands the receiver the stable
///      slice as USDG and the stock slice as tokens, then reports both.
contract MockExitVault {
    MockERC20 public immutable usdg;
    /// @dev The adapter the router reads its pool keys off.
    address public basket;
    uint256 public stableOut;
    address[] internal _tokens;
    uint256[] internal _amounts;

    constructor(MockERC20 usdg_, address basket_) {
        usdg = usdg_;
        basket = basket_;
    }

    function asset() external view returns (address) {
        return address(usdg);
    }

    function setPayout(uint256 stableOut_, address[] calldata tokens_, uint256[] calldata amounts_) external {
        stableOut = stableOut_;
        _tokens = tokens_;
        _amounts = amounts_;
    }

    function redeemInKind(uint256, address receiver, address)
        external
        returns (uint256, address[] memory, uint256[] memory)
    {
        usdg.mint(receiver, stableOut);
        for (uint256 i; i < _tokens.length; i++) {
            if (_amounts[i] > 0) MockERC20(_tokens[i]).mint(receiver, _amounts[i]);
        }
        return (stableOut, _tokens, _amounts);
    }
}

contract ExitRouterTest is Test {
    MockERC20 usdg;
    MockERC20 nvda;
    MockERC20 aapl;
    MockExitVault vault;
    MockExitBasket basket;
    StubExitRouter router;
    address user = address(0xBEEF);

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        nvda = new MockERC20("NVDA", "NVDA", 18);
        aapl = new MockERC20("AAPL", "AAPL", 18);
        basket = new MockExitBasket();
        /* Not a uniform basket: NVDA at 0.30%, AAPL at 1%. The live one is the
           same shape — the four original names trade at 0.30% and the ones
           added later do not. */
        basket.setPool(address(nvda), address(usdg), 3000, 60);
        basket.setPool(address(aapl), address(usdg), 10000, 200);
        vault = new MockExitVault(usdg, address(basket));
        router = new StubExitRouter(usdg);
    }

    /// $3 stable + $2 held entirely in NVDA -> $5 all in USDG.
    function test_exitSellsStocksAndPaysStable() public {
        address[] memory t = new address[](2);
        t[0] = address(nvda);
        t[1] = address(aapl);
        uint256[] memory a = new uint256[](2);
        a[0] = 2e18; // $2 of NVDA
        a[1] = 0; // nothing in AAPL, mirroring the real concentrated basket
        vault.setPayout(3_000_000, t, a);

        vm.prank(user);
        uint256 got = router.exitToStable(address(vault), 5e12, 5_000_000);

        assertEq(got, 5_000_000, "total USDG");
        assertEq(usdg.balanceOf(user), 5_000_000, "user paid in USDG");
        assertEq(usdg.balanceOf(address(router)), 0, "router keeps nothing");
    }

    /// The floor is the only guard against a bad fill; it must bite.
    function test_revertsBelowMin() public {
        address[] memory t = new address[](1);
        t[0] = address(nvda);
        uint256[] memory a = new uint256[](1);
        a[0] = 2e18;
        vault.setPayout(3_000_000, t, a);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(ExitRouterCore.BelowMin.selector, 5_000_000, 6_000_000));
        router.exitToStable(address(vault), 5e12, 6_000_000);
    }

    function test_revertsZeroShares() public {
        vm.prank(user);
        vm.expectRevert(ExitRouterCore.SharesZero.selector);
        router.exitToStable(address(vault), 0, 0);
    }

    /// A pure-stable position (no stock tokens) still exits cleanly.
    function test_stableOnlyPosition() public {
        address[] memory t = new address[](0);
        uint256[] memory a = new uint256[](0);
        vault.setPayout(4_000_000, t, a);

        vm.prank(user);
        uint256 got = router.exitToStable(address(vault), 4e12, 4_000_000);
        assertEq(got, 4_000_000);
        assertEq(usdg.balanceOf(user), 4_000_000);
    }

    /// The regression this router was redeployed for.
    ///
    /// The first version built every PoolKey from a constant 0.30% tier. That
    /// held for the four names the basket launched with and broke the day it
    /// grew: SPCX and PLTR trade at 1%, their 0.30% pools hold nothing, the
    /// swap reverted, and it took the whole exit with it. So the assertion is
    /// not "the exit worked" — it is that each leg was routed through the tier
    /// the adapter names, and that the two legs differ.
    function test_routesEachLegThroughTheAdaptersOwnFeeTier() public {
        address[] memory t = new address[](2);
        t[0] = address(nvda);
        t[1] = address(aapl);
        uint256[] memory a = new uint256[](2);
        a[0] = 2e18;
        a[1] = 3e18;
        vault.setPayout(0, t, a);

        vm.prank(user);
        router.exitToStable(address(vault), 5e12, 5_000_000);

        assertEq(router.feesSeenLength(), 2, "both legs swapped");
        assertEq(router.feesSeen(0), 3000, "NVDA routed at 0.30%");
        assertEq(router.feesSeen(1), 10000, "AAPL routed at 1%, not the old constant");
    }
}
