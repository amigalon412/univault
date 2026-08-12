// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {SafexStaking} from "../src/SafexStaking.sol";
import {MockERC20} from "./mocks/Mocks.sol";

/// @dev Staked token and reward token are the SAME here, because that is the
///      configuration this ships in and the one where the mistakes live: with
///      one token the contract's balance is principal and rewards mixed
///      together, and the whole question is whether principal can be spent.
contract SafexStakingTest is Test {
    SafexStaking staking;
    MockERC20 token;

    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address bob = address(0xCA10);

    uint256 constant WINDOW = 30 days;

    function setUp() public {
        token = new MockERC20("SAFEX", "SAFEX", 18);
        staking = new SafexStaking(owner, WINDOW);
        vm.prank(owner);
        staking.setToken(address(token));

        token.mint(alice, 1_000e18);
        token.mint(bob, 1_000e18);
        token.mint(owner, 1_000e18);

        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
    }

    /// @dev The owner's normal move: send the pot, then set the window.
    function _fund(uint256 amount) internal {
        vm.startPrank(owner);
        token.transfer(address(staking), amount);
        staking.notifyRewardAmount(amount);
        vm.stopPrank();
    }

    /* ── the invariant that matters ───────────────────────────────────── */

    /// Principal is not a reward pot. With stake and reward being one token,
    /// a contract that got this wrong would read a fat balance and happily
    /// promise it away.
    function test_cannotFundRewardsFromStakedPrincipal() public {
        vm.prank(alice);
        staking.stake(500e18);

        // 500e18 sitting in the contract, every wei of it Alice's.
        assertEq(token.balanceOf(address(staking)), 500e18);
        assertEq(staking.unallocatedRewards(), 0);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SafexStaking.InsufficientRewardBudget.selector, 500e18 - (500e18 % WINDOW), 0)
        );
        staking.notifyRewardAmount(500e18);
    }

    /// However rewards are paid, every staker must still be able to take their
    /// whole principal back out.
    function test_principalAlwaysWithdrawableInFull() public {
        vm.prank(alice);
        staking.stake(400e18);
        vm.prank(bob);
        staking.stake(600e18);
        _fund(100e18);

        vm.warp(block.timestamp + WINDOW + 1);

        vm.prank(alice);
        staking.exit();
        vm.prank(bob);
        staking.exit();

        assertEq(staking.totalStaked(), 0);
        assertGe(token.balanceOf(alice), 1_000e18, "alice lost principal");
        assertGe(token.balanceOf(bob), 1_000e18, "bob lost principal");
    }

    /* ── accrual ──────────────────────────────────────────────────────── */

    function test_rewardsAccrueOverTheWindow() public {
        vm.prank(alice);
        staking.stake(100e18);
        _fund(300e18);

        vm.warp(block.timestamp + WINDOW / 2);
        // Half the window, one staker: about half the pot. Rounding is down.
        assertApproxEqRel(staking.earned(alice), 150e18, 1e12);

        vm.warp(block.timestamp + WINDOW);
        assertApproxEqRel(staking.earned(alice), 300e18, 1e12);
    }

    function test_twoStakersSplitProRata() public {
        vm.prank(alice);
        staking.stake(100e18);
        vm.prank(bob);
        staking.stake(300e18);
        _fund(400e18);

        vm.warp(block.timestamp + WINDOW + 1);

        // 1:3 stake, so 1:3 of the pot.
        assertApproxEqRel(staking.earned(alice), 100e18, 1e12);
        assertApproxEqRel(staking.earned(bob), 300e18, 1e12);
    }

    /// Seconds that pass with nobody staked must not be credited to whoever
    /// turns up first -- they stay in the pot for a later window.
    function test_noAccrualWhileNothingIsStaked() public {
        _fund(300e18);
        vm.warp(block.timestamp + WINDOW / 2);

        vm.prank(alice);
        staking.stake(100e18);
        assertEq(staking.earned(alice), 0);

        vm.warp(block.timestamp + WINDOW);
        // Only the second half of the window was hers.
        assertApproxEqRel(staking.earned(alice), 150e18, 1e12);
    }

    function test_claimPaysAndZeroes() public {
        vm.prank(alice);
        staking.stake(100e18);
        _fund(200e18);
        vm.warp(block.timestamp + WINDOW + 1);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        staking.claim();

        assertApproxEqRel(token.balanceOf(alice) - before, 200e18, 1e12);
        assertEq(staking.earned(alice), 0);
    }

    /* ── funding ──────────────────────────────────────────────────────── */

    /// Topping up mid-window is the normal way to use this, so what is left of
    /// the running period has to roll into the new rate rather than be lost.
    function test_topUpRollsInTheLeftover() public {
        vm.prank(alice);
        staking.stake(100e18);
        _fund(300e18);

        vm.warp(block.timestamp + WINDOW / 2);
        uint256 leftover = staking.remainingRewards();
        assertApproxEqRel(leftover, 150e18, 1e12);

        _fund(300e18);

        // New window carries the unpaid half of the old one plus the top-up.
        assertApproxEqRel(staking.remainingRewards(), leftover + 300e18, 1e12);
    }

    function test_notifyRevertsWithoutTokensInHand() public {
        vm.prank(owner);
        vm.expectRevert();
        staking.notifyRewardAmount(100e18);
    }

    function test_onlyOwnerCanNotify() public {
        token.mint(address(staking), 100e18);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.notifyRewardAmount(100e18);
    }

    /* ── owner limits ─────────────────────────────────────────────────── */

    /// Re-rating a live window would silently move money already promised.
    function test_durationLockedWhileWindowRuns() public {
        _fund(100e18);
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(SafexStaking.PeriodStillActive.selector, block.timestamp + WINDOW)
        );
        staking.setRewardsDuration(7 days);

        vm.warp(block.timestamp + WINDOW + 1);
        vm.prank(owner);
        staking.setRewardsDuration(7 days);
        assertEq(staking.rewardsDuration(), 7 days);
    }

    /// The sweep is for tokens sent here by mistake. It is not a way to pull
    /// back a reward pot stakers are already earning against.
    function test_ownerCannotSweepTheStakingToken() public {
        vm.prank(alice);
        staking.stake(100e18);
        _fund(100e18);

        vm.prank(owner);
        vm.expectRevert(SafexStaking.CannotRecoverStakingToken.selector);
        staking.recoverERC20(address(token), 1);
    }

    function test_ownerCanSweepAStrayToken() public {
        MockERC20 stray = new MockERC20("Stray", "STRAY", 18);
        stray.mint(address(staking), 5e18);

        vm.prank(owner);
        staking.recoverERC20(address(stray), 5e18);
        assertEq(stray.balanceOf(owner), 5e18);
    }

    /* ── the shape of the thing ───────────────────────────────────────── */

    /// Withdrawing does not forfeit what has already been earned.
    function test_withdrawKeepsEarnedRewards() public {
        vm.prank(alice);
        staking.stake(100e18);
        _fund(200e18);
        vm.warp(block.timestamp + WINDOW + 1);

        vm.prank(alice);
        staking.withdraw(100e18);
        assertApproxEqRel(staking.earned(alice), 200e18, 1e12);

        vm.prank(alice);
        staking.claim();
        assertApproxEqRel(token.balanceOf(alice), 1_200e18, 1e12);
    }

    function testFuzz_neverPaysOutMoreThanItHolds(uint96 stakeAmount, uint96 rewardAmount, uint32 elapsed) public {
        stakeAmount = uint96(bound(stakeAmount, 1e6, 1_000e18));
        rewardAmount = uint96(bound(rewardAmount, WINDOW, 1_000e18));
        elapsed = uint32(bound(elapsed, 0, WINDOW * 2));

        token.mint(alice, stakeAmount);
        vm.prank(alice);
        staking.stake(stakeAmount);

        token.mint(owner, rewardAmount);
        vm.startPrank(owner);
        token.transfer(address(staking), rewardAmount);
        staking.notifyRewardAmount(rewardAmount);
        vm.stopPrank();

        vm.warp(block.timestamp + elapsed);

        // Whatever the accumulator says, the contract can actually pay it and
        // still return every wei of principal.
        uint256 owed = staking.earned(alice) + staking.totalStaked();
        assertLe(owed, token.balanceOf(address(staking)), "contract owes more than it holds");

        vm.prank(alice);
        staking.exit();
    }
}

/// @dev The wiring step, which exists because this contract is deployed before
///      the token it pays in. Its own file-scope suite so `setUp` can leave the
///      contract unwired -- every test above starts from a wired one.
contract SafexStakingWiringTest is Test {
    SafexStaking staking;
    MockERC20 token;

    address owner = address(0xA11CE);
    address alice = address(0xB0B);

    function setUp() public {
        token = new MockERC20("SAFEX", "SAFEX", 18);
        staking = new SafexStaking(owner, 30 days);
    }

    function test_deploysUnwired() public view {
        assertFalse(staking.tokenIsSet());
        assertEq(address(staking.stakingToken()), address(0));
        assertEq(staking.unallocatedRewards(), 0);
    }

    /// Nothing that could move value may work before the token is known.
    function test_nothingWorksBeforeTheTokenIsSet() public {
        vm.prank(alice);
        vm.expectRevert(SafexStaking.TokenNotSet.selector);
        staking.stake(1e18);

        vm.prank(owner);
        vm.expectRevert(SafexStaking.TokenNotSet.selector);
        staking.notifyRewardAmount(1e18);
    }

    function test_setTokenWiresBothSides() public {
        vm.prank(owner);
        staking.setToken(address(token));

        assertTrue(staking.tokenIsSet());
        assertEq(address(staking.stakingToken()), address(token));
        assertEq(address(staking.rewardToken()), address(token));
    }

    /// Once, and then never again -- otherwise an owner could swap the reward
    /// token out from under people who had already staked.
    function test_tokenCannotBeChanged() public {
        MockERC20 other = new MockERC20("Other", "OTHER", 18);

        vm.startPrank(owner);
        staking.setToken(address(token));
        vm.expectRevert(abi.encodeWithSelector(SafexStaking.TokenAlreadySet.selector, address(token)));
        staking.setToken(address(other));
        vm.stopPrank();

        assertEq(address(staking.stakingToken()), address(token));
    }

    function test_onlyOwnerCanWire() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        staking.setToken(address(token));
    }

    function test_rejectsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(SafexStaking.ZeroAddress.selector);
        staking.setToken(address(0));
    }

    /// After wiring it behaves exactly as if the address had been baked in.
    function test_worksNormallyOnceWired() public {
        vm.prank(owner);
        staking.setToken(address(token));

        token.mint(alice, 100e18);
        vm.startPrank(alice);
        token.approve(address(staking), type(uint256).max);
        staking.stake(100e18);
        vm.stopPrank();

        token.mint(owner, 300e18);
        vm.startPrank(owner);
        token.transfer(address(staking), 300e18);
        staking.notifyRewardAmount(300e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days + 1);
        assertApproxEqRel(staking.earned(alice), 300e18, 1e12);
    }
}
