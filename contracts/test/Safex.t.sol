// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

/// @notice Deterministic tests. The fork suite proves we are wired to the real
///         chain; this one proves the accounting is right, at a speed and
///         repeatability a fork cannot give.
contract SafexTest is Test {
    MockERC20 usdg;
    MockYieldVault yieldVault;
    Safex vault;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant ONE = 1e6;
    uint256 constant APR_BPS = 700; // 7%, matching what Robinhood Earn advertises

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        yieldVault = new MockYieldVault(IERC20(address(usdg)), APR_BPS);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(yieldVault)), "Safex Steady", "sfxSTEADY", owner);
        vm.prank(owner);
        vault.setAutoAllocate(false); // these tests drive deployIdle by hand

        usdg.mint(alice, 1_000_000 * ONE);
        usdg.mint(bob, 1_000_000 * ONE);
    }

    // ------------------------------------------------------------------

    function test_DecimalsCarryOffset() public view {
        assertEq(vault.decimals(), 12);
    }

    function test_SharesAreProportional() public {
        _deposit(alice, 1_000 * ONE);
        _deposit(bob, 3_000 * ONE);
        assertApproxEqRel(
            vault.previewRedeem(vault.balanceOf(bob)),
            vault.previewRedeem(vault.balanceOf(alice)) * 3,
            1e12
        );
    }

    function test_RoundTripNeverProfits() public {
        uint256 amount = 5_000 * ONE;
        _deposit(alice, amount);

        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.redeem(shares, alice, alice);

        assertLe(out, amount, "value created from nothing");
        assertApproxEqAbs(out, amount, 2, "lost more than rounding dust");
    }

    function test_YieldLiftsSharePrice() public {
        _deposit(alice, 10_000 * ONE);

        vm.prank(owner);
        assertGt(vault.deployIdle(), 0);

        uint256 priceBefore = vault.convertToAssets(1e12);

        vm.warp(block.timestamp + 365 days);
        yieldVault.accrue();

        uint256 priceAfter = vault.convertToAssets(1e12);
        assertGt(priceAfter, priceBefore, "share price flat despite yield");

        // 95% of the balance is deployed at 7%, so ~6.65% at the vault level.
        uint256 gainBps = ((priceAfter - priceBefore) * 10_000) / priceBefore;
        assertApproxEqAbs(gainBps, 665, 15, "yield did not reach depositors");
        console2.log("vault-level gain over a year (bps):", gainBps);
    }

    function test_ExitAfterDeployPaysPrincipalPlusYield() public {
        uint256 amount = 10_000 * ONE;
        _deposit(alice, amount);

        vm.prank(owner);
        vault.deployIdle();

        vm.warp(block.timestamp + 180 days);
        yieldVault.accrue();

        uint256 grossGain = vault.totalAssets() - amount;

        uint256 before = usdg.balanceOf(alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        uint256 received = usdg.balanceOf(alice) - before;
        assertGt(received, amount, "exited with less than deposited");

        // Alice keeps the gain net of the fee; what stays behind is exactly the
        // treasury's claim on it, not stranded value.
        assertApproxEqRel(received - amount, (grossGain * 9_500) / 10_000, 1e15, "alice did not keep 95% of the gain");
        assertApproxEqRel(vault.totalAssets(), (grossGain * 500) / 10_000, 2e16, "leftover is not the fee");
        assertApproxEqAbs(
            vault.previewRedeem(vault.balanceOf(vault.feeRecipient())),
            vault.totalAssets(),
            2,
            "leftover is not claimable by the fee recipient"
        );
    }

    function test_SecondDepositorDoesNotDiluteTheFirst() public {
        _deposit(alice, 10_000 * ONE);
        vm.prank(owner);
        vault.deployIdle();

        vm.warp(block.timestamp + 90 days);
        yieldVault.accrue();

        // Settle the fee first, so this measures dilution by bob and not the
        // fee that bob's deposit would otherwise have triggered.
        vault.accrueFee();
        uint256 aliceValueBefore = vault.previewRedeem(vault.balanceOf(alice));

        _deposit(bob, 50_000 * ONE);

        assertApproxEqAbs(
            vault.previewRedeem(vault.balanceOf(alice)),
            aliceValueBefore,
            2,
            "bob's deposit moved alice's claim"
        );
    }

    function test_FeeIsTakenOnceOnTheGain() public {
        _deposit(alice, 10_000 * ONE);
        vm.prank(owner);
        vault.deployIdle();

        vm.warp(block.timestamp + 90 days);
        yieldVault.accrue();

        uint256 grossGain = vault.totalAssets() - 10_000 * ONE;
        vault.accrueFee();

        address treasury = vault.feeRecipient();
        assertApproxEqRel(
            vault.previewRedeem(vault.balanceOf(treasury)),
            (grossGain * 500) / 10_000,
            2e16,
            "fee is not 5% of the gain"
        );

        // A second call with no new gain charges nothing.
        uint256 held = vault.balanceOf(treasury);
        assertEq(vault.accrueFee(), 0);
        assertEq(vault.balanceOf(treasury), held, "charged twice");
    }

    // ------------------------------------------------------------------
    // Attacks
    // ------------------------------------------------------------------

    function test_InflationAttackFails() public {
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(1, alice);
        usdg.transfer(address(vault), 10_000 * ONE); // donation, not a deposit
        vm.stopPrank();

        uint256 victimDeposit = 5_000 * ONE;
        _deposit(bob, victimDeposit);

        uint256 victimShares = vault.balanceOf(bob);
        assertGt(victimShares, 0, "victim rounded to zero shares");

        vm.prank(bob);
        uint256 recovered = vault.redeem(victimShares, bob, bob);
        assertGe(recovered, (victimDeposit * 9999) / 10_000, "victim lost value to the attacker");
    }

    function test_OwnerCannotTakeDepositorFunds() public {
        _deposit(alice, 1_000 * ONE);
        uint256 ownerBefore = usdg.balanceOf(owner);

        vm.startPrank(owner);
        vault.deployIdle();
        vault.recallAll();
        vault.setBufferBps(0);
        vault.deployIdle();
        vm.stopPrank();

        assertEq(usdg.balanceOf(owner), ownerBefore, "owner extracted assets");
        assertEq(vault.balanceOf(owner), 0, "owner minted itself shares");
        assertApproxEqAbs(vault.previewRedeem(vault.balanceOf(alice)), 1_000 * ONE, 2, "alice's claim moved");
    }

    // ------------------------------------------------------------------
    // Fuzz
    // ------------------------------------------------------------------

    function testFuzz_RoundTripNeverProfits(uint96 raw) public {
        uint256 amount = bound(uint256(raw), 1, 500_000 * ONE);
        usdg.mint(alice, amount);

        vm.startPrank(alice);
        usdg.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        uint256 out = vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertLe(out, amount, "round trip printed money");
    }

    function testFuzz_DepositThenRedeemIsMonotonic(uint96 a, uint96 b) public {
        uint256 amountA = bound(uint256(a), ONE, 100_000 * ONE);
        uint256 amountB = bound(uint256(b), ONE, 100_000 * ONE);

        _deposit(alice, amountA);
        _deposit(bob, amountB);

        // Whoever put in more must be able to take out at least as much.
        uint256 valueA = vault.previewRedeem(vault.balanceOf(alice));
        uint256 valueB = vault.previewRedeem(vault.balanceOf(bob));
        if (amountA > amountB) assertGe(valueA + 2, valueB);
        else assertGe(valueB + 2, valueA);
    }

    // ------------------------------------------------------------------

    function _deposit(address who, uint256 amount) internal {
        vm.startPrank(who);
        usdg.approve(address(vault), amount);
        vault.deposit(amount, who);
        vm.stopPrank();
    }
}
