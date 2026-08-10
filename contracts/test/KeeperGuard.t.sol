// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Univault} from "../src/Univault.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

contract KeeperGuardTest is Test {
    MockERC20 usdg;
    MockYieldVault yieldVault;
    Univault vault;
    KeeperGuard guard;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address sentinel = makeAddr("sentinel");
    address alice = makeAddr("alice");
    address attacker = makeAddr("attacker");

    uint256 constant ONE = 1e6;
    uint256 constant CAP = 50_000 * ONE;
    uint32 constant COOLDOWN = 1 hours;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        yieldVault = new MockYieldVault(IERC20(address(usdg)), 700);
        vault = new Univault(IERC20(address(usdg)), IERC4626(address(yieldVault)), "BLUR", "blur", owner);
        guard = new KeeperGuard(owner, CAP, COOLDOWN);

        vm.startPrank(owner);
        guard.setKeeper(keeper, true);
        guard.setVault(address(vault), true);
        guard.setSentinel(sentinel, true);
        vault.setGuard(address(guard));
        vault.setAutoAllocate(false); // these tests drive allocation through the guard
        vm.stopPrank();

        usdg.mint(alice, 5_000_000 * ONE);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(1_000_000 * ONE, alice);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------
    // It works
    // ------------------------------------------------------------------

    function test_KeeperCanAllocate() public {
        vm.prank(keeper);
        uint256 deployed = guard.deployIdle(address(vault));

        assertEq(deployed, CAP, "should have moved exactly the cap");
        assertEq(yieldVault.convertToAssets(yieldVault.balanceOf(address(vault))), CAP);
    }

    function test_OwnerCanStillAllocateDirectly() public {
        vm.prank(owner);
        uint256 deployed = vault.deployIdle();
        assertGt(deployed, CAP, "owner is not bound by the guard's cap");
    }

    // ------------------------------------------------------------------
    // Limits
    // ------------------------------------------------------------------

    function test_SizeCapIsEnforced() public {
        vm.prank(keeper);
        guard.deployIdle(address(vault));

        // 1,000,000 deposited, 5% buffer, so ~950,000 is deployable — the cap
        // must be what actually bound the call.
        assertEq(yieldVault.convertToAssets(yieldVault.balanceOf(address(vault))), CAP);
    }

    function test_CooldownIsEnforced() public {
        vm.prank(keeper);
        guard.deployIdle(address(vault));

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.CoolingDown.selector);
        guard.deployIdle(address(vault));

        vm.warp(block.timestamp + COOLDOWN);
        vm.prank(keeper);
        guard.deployIdle(address(vault));
        assertEq(yieldVault.convertToAssets(yieldVault.balanceOf(address(vault))), 2 * CAP);
    }

    function test_NonKeeperCannotAllocate() public {
        vm.prank(attacker);
        vm.expectRevert(KeeperGuard.NotKeeper.selector);
        guard.deployIdle(address(vault));
    }

    function test_KeeperCannotDriveAnUnregisteredVault() public {
        Univault other =
            new Univault(IERC20(address(usdg)), IERC4626(address(yieldVault)), "other", "other", owner);

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.VaultNotAllowed.selector);
        guard.deployIdle(address(other));
    }

    function test_RevokedKeeperIsLockedOut() public {
        vm.prank(owner);
        guard.setKeeper(keeper, false);

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.NotKeeper.selector);
        guard.deployIdle(address(vault));
    }

    // ------------------------------------------------------------------
    // Halting
    // ------------------------------------------------------------------

    function test_SentinelCanHaltButNotRunOrResume() public {
        vm.prank(sentinel);
        guard.pause();

        vm.prank(keeper);
        vm.expectRevert(KeeperGuard.Paused.selector);
        guard.deployIdle(address(vault));

        // A sentinel cannot bring it back.
        vm.prank(sentinel);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, sentinel));
        guard.unpause();

        // Nor can it run automation itself.
        vm.prank(owner);
        guard.unpause();
        vm.prank(sentinel);
        vm.expectRevert(KeeperGuard.NotKeeper.selector);
        guard.deployIdle(address(vault));
    }

    function test_KeeperCannotPause() public {
        // Halting is safe to hand out, but only to addresses chosen for it.
        vm.prank(attacker);
        vm.expectRevert(KeeperGuard.NotSentinel.selector);
        guard.pause();
    }

    // ------------------------------------------------------------------
    // The whole point: a compromised keeper
    // ------------------------------------------------------------------

    function test_CompromisedKeeperCannotTouchAnythingThatMatters() public {
        uint256 aliceClaimBefore = vault.previewRedeem(vault.balanceOf(alice));

        vm.startPrank(keeper);

        // Cannot unwind the position.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.recallAll();

        // Cannot retune the vault.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.setBufferBps(0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.setPerformanceFeeBps(2_000);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.setFeeRecipient(keeper);

        // Cannot take over.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.transferOwnership(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.setGuard(keeper);

        // Cannot widen its own leash.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        guard.setLimits(type(uint256).max, 0);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        guard.setKeeper(attacker, true);

        // Cannot go around the guard to reach the vault directly.
        vm.expectRevert(Univault.NotAutomation.selector);
        vault.deployIdle();
        vm.expectRevert(Univault.NotAutomation.selector);
        vault.deployIdle(type(uint256).max);

        vm.stopPrank();

        assertEq(usdg.balanceOf(keeper), 0, "keeper extracted assets");
        assertEq(vault.balanceOf(keeper), 0, "keeper minted itself shares");
        assertEq(vault.previewRedeem(vault.balanceOf(alice)), aliceClaimBefore, "alice's claim moved");
    }

    /// @notice The realistic worst case: the keeper is stolen and the attacker
    ///         does the only thing it is permitted to do, as often as possible.
    function test_WorstCaseKeeperGriefCostsOnlyDust() public {
        uint256 priceBefore = vault.sharePrice();
        uint256 claimBefore = vault.previewRedeem(vault.balanceOf(alice));

        // A full week of allocating at every opportunity.
        for (uint256 i; i < 168; ++i) {
            vm.warp(block.timestamp + COOLDOWN);
            vm.prank(keeper);
            guard.deployIdle(address(vault));
        }

        uint256 priceAfter = vault.sharePrice();
        uint256 claimAfter = vault.previewRedeem(vault.balanceOf(alice));

        console2.log("share price before:", priceBefore);
        console2.log("share price after :", priceAfter);

        // Allocating puts money to work, so the holder should be better off,
        // not worse. Either way the loss can never exceed rounding dust.
        assertGe(claimAfter + 1_000, claimBefore, "griefing cost the holder real money");
        assertGe(priceAfter, priceBefore - 10, "share price was ground down");
    }
}
