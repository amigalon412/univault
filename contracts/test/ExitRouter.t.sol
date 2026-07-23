// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {ExitRouter} from "../src/ExitRouter.sol";
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

    /// @dev Fills at exactly $1 per whole stock token: 18-dec in, 6-dec USDG out.
    function _executeSwap(SwapRequest memory req) internal override returns (uint256 amountOut) {
        amountOut = req.amountIn / 1e12;
        usdg.mint(address(this), amountOut);
    }
}

/// @dev Stands in for a BLUR vault's redeemInKind: hands the receiver the stable
///      slice as USDG and the stock slice as tokens, then reports both.
contract MockExitVault {
    MockERC20 public immutable usdg;
    uint256 public stableOut;
    address[] internal _tokens;
    uint256[] internal _amounts;

    constructor(MockERC20 usdg_) {
        usdg = usdg_;
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
    StubExitRouter router;
    address user = address(0xBEEF);

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        nvda = new MockERC20("NVDA", "NVDA", 18);
        aapl = new MockERC20("AAPL", "AAPL", 18);
        vault = new MockExitVault(usdg);
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
        vm.expectRevert(abi.encodeWithSelector(ExitRouter.BelowMin.selector, 5_000_000, 6_000_000));
        router.exitToStable(address(vault), 5e12, 6_000_000);
    }

    function test_revertsZeroShares() public {
        vm.prank(user);
        vm.expectRevert(ExitRouter.SharesZero.selector);
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
}
