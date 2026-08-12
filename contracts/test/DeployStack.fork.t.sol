// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {DeployStack, StackConfig, Stack} from "../script/DeployStack.s.sol";
import {RobinhoodChain} from "../src/RobinhoodChain.sol";

/// @notice Asserts the finished state of a deployment rather than trusting that
///         the script was run correctly.
///
/// @dev On a fork, because the whole point is that it wires against the real
///      venue, the real feeds and the real pools. A stack that assembles
///      against mocks proves nothing about the one that will hold money.
contract DeployStackForkTest is Test, DeployStack {

    address owner = makeAddr("owner");
    address deployer = makeAddr("deployer");
    address keeper = makeAddr("keeper");
    address sentinel = makeAddr("sentinel");
    address alice = makeAddr("alice");

    uint256 constant ONE = 1e6;

    function setUp() public {
        vm.createSelectFork(vm.envOr("ROBINHOOD_RPC", vm.rpcUrl("robinhood")));
    }

    function _config(uint16 targetStableBps) internal view returns (StackConfig memory) {
        return StackConfig({
            owner: owner,
            keeper: keeper,
            sentinel: sentinel,
            maxDeployPerCall: 50_000 * ONE,
            cooldown: 1 hours,
            name: "Safex Balanced",
            symbol: "sfxBALANCED",
            targetStableBps: targetStableBps
        });
    }

    /// @dev `deploy` runs in this contract's own frame, exactly as `run` calls
    ///      it. Reaching it across a contract boundary would put the script in
    ///      msg.sender while `deployer` said otherwise, and every wiring call
    ///      would revert -- a failure of the test, not of the deployment.
    function _deploy(uint16 targetStableBps) internal returns (Stack memory s) {
        vm.startPrank(deployer);
        s = deploy(_config(targetStableBps), deployer);
        vm.stopPrank();
    }

    // -----------------------------------------------------------------
    // Wiring
    // -----------------------------------------------------------------

    function test_EverythingEndsUpOwnedByTheOwner() public {
        Stack memory s = _deploy(6_000);

        assertEq(s.vault.owner(), owner, "vault");
        assertEq(s.guard.owner(), owner, "guard");
        assertEq(s.oracle.owner(), owner, "oracle");
        assertEq(s.basket.owner(), owner, "basket");
        assertEq(s.vault.feeRecipient(), owner, "fee recipient");
    }

    function test_GuardAndVaultKnowEachOther() public {
        Stack memory s = _deploy(6_000);

        assertEq(s.vault.guard(), address(s.guard), "vault does not trust the guard");
        assertTrue(s.guard.isVault(address(s.vault)), "guard does not know the vault");
        assertTrue(s.guard.isKeeper(keeper), "keeper not registered");
        assertTrue(s.guard.isSentinel(sentinel), "sentinel not registered");
    }

    function test_BasketIsRegisteredOnTheVault() public {
        Stack memory s = _deploy(6_000);

        assertEq(address(s.vault.basket()), address(s.basket), "basket not registered");
        assertEq(s.vault.targetStableBps(), 6_000);
    }

    /// @dev Every constituent needs a feed and a pool. One missing pool is not
    ///      visible until a rebalance reverts, which is far too late.
    function test_EveryConstituentHasAFeedAndAPool() public {
        Stack memory s = _deploy(6_000);

        address[4] memory tokens = [
            RobinhoodChain.NVDA,
            RobinhoodChain.AAPL,
            RobinhoodChain.TSLA,
            RobinhoodChain.AMZN
        ];

        assertEq(s.basket.tokensLength(), tokens.length, "wrong constituent count");

        for (uint256 i = 0; i < tokens.length; i++) {
            (uint16 weightBps,,, bool set) = s.basket.constituents(tokens[i]);
            assertTrue(set, "constituent missing");
            assertEq(weightBps, 2_500, "weight");

            (Currency c0, Currency c1,,,) = s.basket.poolKeys(tokens[i]);
            address a0 = Currency.unwrap(c0);
            address a1 = Currency.unwrap(c1);
            assertTrue(
                (a0 == RobinhoodChain.USDG && a1 == tokens[i])
                    || (a0 == tokens[i] && a1 == RobinhoodChain.USDG),
                "pool does not name the pair"
            );

            assertGt(s.oracle.priceUsd(tokens[i]), 0, "feed missing");
        }

        assertTrue(s.vault.isPriceable(), "vault cannot price its own basket");
    }

    /// @dev STEADY has nothing to price and nothing to trade, so it should get
    ///      no basket rather than an empty one sitting there half-configured.
    function test_SteadyGetsNoBasket() public {
        Stack memory s = _deploy(10_000);

        assertEq(address(s.basket), address(0), "steady should have no basket");
        assertEq(address(s.vault.basket()), address(0));
        assertTrue(s.vault.isPriceable(), "a vault with no basket is always priceable");
    }

    // -----------------------------------------------------------------
    // It actually runs
    // -----------------------------------------------------------------

    /// @dev The deployment is only finished if a deposit can go in, be put to
    ///      work through the guard, and come back out.
    function test_TheDeployedStackTakesAndReturnsMoney() public {
        Stack memory s = _deploy(6_000);

        // This test drives allocation through the guard, so turn off the
        // deposit-time self-allocation a fresh deployment ships with.
        vm.prank(s.vault.owner());
        s.vault.setAutoAllocate(false);

        deal(RobinhoodChain.USDG, alice, 10_000 * ONE);

        vm.startPrank(alice);
        IERC20(RobinhoodChain.USDG).approve(address(s.vault), type(uint256).max);
        s.vault.deposit(10_000 * ONE, alice);
        vm.stopPrank();

        assertEq(s.vault.totalAssets(), 10_000 * ONE, "deposit did not land");

        vm.prank(keeper);
        s.guard.deployIdle(address(s.vault));

        // The venue under-reports its own maxWithdraw; the vault deliberately
        // does not believe it, so the whole position stays withdrawable.
        assertApproxEqAbs(s.vault.maxWithdraw(alice), 10_000 * ONE, 1, "position locked up");

        uint256 before = IERC20(RobinhoodChain.USDG).balanceOf(alice);
        vm.prank(alice);
        s.vault.withdraw(5_000 * ONE, alice, alice);

        assertEq(
            IERC20(RobinhoodChain.USDG).balanceOf(alice) - before,
            5_000 * ONE,
            "withdrawal short"
        );
    }
}
