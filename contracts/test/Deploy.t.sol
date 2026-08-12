// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";
import {Deploy, DeployConfig} from "../script/Deploy.s.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

/// @notice A misconfigured deployment is the cheapest way to lose money, and
///         the easiest to miss: everything compiles, nothing is wired.
contract DeployTest is Test, Deploy {
    MockERC20 usdg;
    MockYieldVault venue;

    address deployerEOA = makeAddr("deployerEOA");
    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address sentinel = makeAddr("sentinel");
    address alice = makeAddr("alice");

    uint256 constant ONE = 1e6;

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
    }

    function _config() internal view returns (DeployConfig memory) {
        return DeployConfig({
            asset: address(usdg),
            yieldVault: address(venue),
            owner: owner,
            keeper: keeper,
            sentinel: sentinel,
            maxDeployPerCall: 50_000 * ONE,
            cooldown: 1 hours,
            name: "Safex Steady",
            symbol: "sfxSTEADY"
        });
    }

    function test_EverythingIsWiredAndOwnedCorrectly() public {
        (Safex vault, KeeperGuard guard) = _runDeploy(_config());

        assertEq(vault.guard(), address(guard), "vault does not trust the guard");
        assertTrue(guard.isVault(address(vault)), "guard does not know the vault");
        assertTrue(guard.isKeeper(keeper), "keeper not registered");
        assertTrue(guard.isSentinel(sentinel), "sentinel not registered");

        assertEq(vault.owner(), owner, "vault ownership not handed over");
        assertEq(guard.owner(), owner, "guard ownership not handed over");
        assertEq(vault.feeRecipient(), owner, "fees would go to the deployer");

        assertEq(address(vault.asset()), address(usdg));
        assertEq(address(vault.yieldVault()), address(venue));
        assertEq(vault.decimals(), 12);
        assertEq(vault.sharePrice(), ONE, "did not start at par");
        assertEq(guard.maxDeployPerCall(), 50_000 * ONE);
        assertEq(guard.cooldown(), 1 hours);
    }

    function test_DeployerRetainsNothing() public {
        address deployer = deployerEOA;
        (Safex vault, KeeperGuard guard) = _runDeploy(_config());

        assertFalse(guard.isKeeper(deployer), "deployer left itself a keeper");
        assertFalse(guard.isSentinel(deployer), "deployer left itself a sentinel");
        assertEq(vault.balanceOf(deployer), 0);

        vm.startPrank(deployer);
        vm.expectRevert();
        vault.setGuard(deployer);
        vm.expectRevert();
        guard.setKeeper(deployer, true);
        vm.stopPrank();
    }

    /// @notice The deployment is usable end to end without further setup.
    function test_FreshDeploymentWorksImmediately() public {
        (Safex vault, KeeperGuard guard) = _runDeploy(_config());

        // This test drives allocation through the keeper, so turn off the
        // deposit-time self-allocation a fresh deployment ships with.
        vm.prank(vault.owner());
        vault.setAutoAllocate(false);

        usdg.mint(alice, 1_000_000 * ONE);
        vm.startPrank(alice);
        usdg.approve(address(vault), type(uint256).max);
        vault.deposit(200_000 * ONE, alice);
        vm.stopPrank();

        vm.prank(keeper);
        uint256 deployed = guard.deployIdle(address(vault));
        assertEq(deployed, 50_000 * ONE, "keeper could not allocate on a fresh deployment");

        vm.warp(block.timestamp + 180 days);
        venue.accrue();

        uint256 before = usdg.balanceOf(alice);
        uint256 shares = vault.balanceOf(alice);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);

        assertGt(usdg.balanceOf(alice) - before, 200_000 * ONE, "no yield reached the depositor");
        assertGt(vault.balanceOf(owner), 0, "no fee reached the owner");
    }

    function test_OwnerCanBeTheDeployer() public {
        DeployConfig memory cfg = _config();
        cfg.owner = deployerEOA;

        (Safex vault, KeeperGuard guard) = _runDeploy(cfg);
        assertEq(vault.owner(), deployerEOA);
        assertEq(guard.owner(), deployerEOA);
    }

    /// @dev `deploy` must run in the caller's own frame, exactly as `run` calls
    ///      it. Invoking it across a contract boundary would put the script
    ///      itself in `msg.sender`, and the wiring calls would come from an
    ///      address that owns nothing — a failure mode of the test, not the
    ///      deployment. Hence inheriting the script rather than instantiating it.
    function _runDeploy(DeployConfig memory cfg) internal returns (Safex, KeeperGuard) {
        vm.startPrank(deployerEOA);
        (Safex v, KeeperGuard g) = deploy(cfg, deployerEOA);
        vm.stopPrank();
        return (v, g);
    }
}
