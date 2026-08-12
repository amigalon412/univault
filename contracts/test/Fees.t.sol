// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

contract FeesTest is Test {
    MockERC20 usdg;
    MockYieldVault yieldVault;
    Safex vault;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");

    uint256 constant ONE = 1e6;
    uint256 constant PAR = 1e6; // one whole share at par

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        yieldVault = new MockYieldVault(IERC20(address(usdg)), 0); // no auto-yield; tests move the price
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(yieldVault)), "BLUR", "blur", owner);

        vm.prank(owner);
        vault.setFeeRecipient(treasury);

        usdg.mint(alice, 10_000_000 * ONE);
        vm.prank(alice);
        usdg.approve(address(vault), type(uint256).max);
    }

    /// @dev Move the share price by donating (gain) or by the vault losing value.
    ///      Donation is the cleanest way to simulate yield without a rate model.
    function _setSharePriceTo(uint256 targetPrice) internal {
        uint256 supply = vault.totalSupply();
        uint256 wanted = (targetPrice * supply) / 10 ** vault.decimals();
        uint256 have = vault.totalAssets();
        require(wanted >= have, "cannot simulate a loss by donating");
        if (wanted > have) usdg.mint(address(vault), wanted - have);
    }

    function test_StartsAtPar() public view {
        assertEq(vault.sharePrice(), PAR, "one share should be worth 1 USDG at par");
        assertEq(vault.highWaterMark(), PAR);
        assertEq(vault.performanceFeeBps(), 500);
    }

    /// @notice Reproduces the table published in docs/fees, row for row.
    ///
    ///   Start      1.00   -
    ///   Gain       1.10   5% of 0.10
    ///   Drawdown   0.95   none
    ///   Back       1.10   none, still below the mark
    ///   New high   1.20   5% of 0.10
    function test_DocsFeeTableIsAccurate() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        assertEq(vault.sharePrice(), PAR, "start");
        assertEq(vault.balanceOf(treasury), 0, "no fee before any gain");

        // Gain to 1.10 -> fee on 0.10 per share.
        _setSharePriceTo(1_100_000);
        uint256 feeShares = vault.accrueFee();
        assertGt(feeShares, 0, "gain went uncharged");

        uint256 feeValue = vault.previewRedeem(vault.balanceOf(treasury));
        // 100,000 shares' worth of gain = 10,000 USDG; 5% of that is 500.
        assertApproxEqRel(feeValue, 500 * ONE, 1e15, "fee is not 5% of the gain");
        assertApproxEqAbs(vault.highWaterMark(), 1_100_000, 2, "mark did not move to the new high");

        // Drawdown to 0.95 -> nothing charged.
        uint256 treasuryBefore = vault.balanceOf(treasury);
        _simulateLossTo(950_000);
        assertEq(vault.accrueFee(), 0, "charged a fee during a drawdown");
        assertEq(vault.balanceOf(treasury), treasuryBefore, "treasury grew in a drawdown");
        assertApproxEqAbs(vault.highWaterMark(), 1_100_000, 2, "mark moved down");

        // Back to 1.10 -> still nothing, the recovery is free.
        _setSharePriceTo(1_100_000);
        assertEq(vault.accrueFee(), 0, "charged twice for the same gain");
        assertEq(vault.balanceOf(treasury), treasuryBefore, "treasury grew on a recovery");

        // New high 1.20 -> fee on 0.10 only.
        _setSharePriceTo(1_200_000);
        uint256 valueBefore = vault.previewRedeem(vault.balanceOf(treasury));
        vault.accrueFee();
        uint256 charged = vault.previewRedeem(vault.balanceOf(treasury)) - valueBefore;

        // Gain above the mark is 0.10 per share over ~100,000 shares.
        assertApproxEqRel(charged, 500 * ONE, 2e16, "new-high fee is not 5% of the fresh gain");
        assertApproxEqAbs(vault.highWaterMark(), 1_200_000, 2);
    }

    function test_FeeNeverTouchesPrincipal() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        uint256 principal = 100_000 * ONE;

        // Flat price, many accrual attempts.
        for (uint256 i; i < 10; ++i) {
            vm.warp(block.timestamp + 30 days);
            assertEq(vault.accrueFee(), 0, "charged a fee with no gain");
        }

        assertEq(vault.balanceOf(treasury), 0, "treasury minted itself shares");
        assertApproxEqAbs(vault.previewRedeem(vault.balanceOf(alice)), principal, 2, "principal was eroded");
    }

    function test_FeeIsMintedNotWithdrawn() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);

        uint256 assetsBefore = vault.totalAssets();
        _setSharePriceTo(1_100_000);
        uint256 assetsAfterGain = vault.totalAssets();

        vault.accrueFee();

        assertEq(vault.totalAssets(), assetsAfterGain, "assets left the vault to pay the fee");
        assertGt(vault.totalAssets(), assetsBefore);
        assertEq(usdg.balanceOf(treasury), 0, "treasury received assets directly");
    }

    function test_DepositorAfterAGainDoesNotPayForIt() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _setSharePriceTo(1_100_000);

        address bob = makeAddr("bob");
        usdg.mint(bob, 50_000 * ONE);
        vm.startPrank(bob);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(50_000 * ONE, bob);
        vm.stopPrank();

        // Bob enters after the fee has been assessed, so his claim is his deposit.
        assertApproxEqRel(vault.previewRedeem(vault.balanceOf(bob)), 50_000 * ONE, 1e15, "bob was charged on entry");

        // And no further fee is owed on Alice's gain.
        assertEq(vault.accrueFee(), 0, "gain charged twice");
    }

    function test_SettingFeeSettlesAtTheOldRateFirst() public {
        vm.prank(alice);
        vault.deposit(100_000 * ONE, alice);
        _setSharePriceTo(1_100_000);

        vm.prank(owner);
        vault.setPerformanceFeeBps(0);

        // The gain that happened under the 5% rate was charged at 5%.
        assertApproxEqRel(
            vault.previewRedeem(vault.balanceOf(treasury)), 500 * ONE, 1e15, "old-rate gain was not settled"
        );

        // Later gains are free.
        _setSharePriceTo(1_300_000);
        uint256 before = vault.balanceOf(treasury);
        vault.accrueFee();
        assertEq(vault.balanceOf(treasury), before, "charged after the fee was zeroed");
    }

    function test_FeeCannotBeSetAbsurdlyHigh() public {
        vm.prank(owner);
        vm.expectRevert(Safex.FeeTooHigh.selector);
        vault.setPerformanceFeeBps(2_001);
    }

    // ------------------------------------------------------------------

    /// @dev Burn assets out of the mock venue to push the price down.
    function _simulateLossTo(uint256 targetPrice) internal {
        uint256 supply = vault.totalSupply();
        uint256 wanted = (targetPrice * supply) / 10 ** vault.decimals();
        uint256 have = vault.totalAssets();
        require(have >= wanted, "target is above current price");
        uint256 burn = have - wanted;

        // Take it out of whatever the vault is holding directly.
        uint256 idle = usdg.balanceOf(address(vault));
        require(idle >= burn, "loss larger than idle balance");
        vm.prank(address(vault));
        usdg.transfer(address(0xdead), burn);
    }
}
