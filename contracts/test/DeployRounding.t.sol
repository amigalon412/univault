// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {Safex} from "../src/Safex.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

/// @dev Where the share price loses ground. Reduced by hand from the sequence
///      the invariant fuzzer shrank to: deposit, let the venue accrue, recall
///      everything, deposit dust. The question this answers is not "does it
///      fall" -- the fuzzer already showed that -- but BY HOW MUCH and INTO
///      WHOSE POCKET, because a wei of ERC-4626 rounding is unavoidable and a
///      systematic leak is not.
contract DeployRoundingTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    Safex vault;

    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex", "sfx", owner);

        usdg.mint(alice, 1_000_000e6);
        vm.prank(alice);
        usdg.approve(address(vault), type(uint256).max);
    }

    function _price() internal view returns (uint256) {
        return vault.convertToAssets(1e12);
    }

    /// One deploy into a venue whose share price is above par. The vault hands
    /// over assets and is credited in shares, and the shares round down.
    function test_measureLossOnASingleDeploy() public {
        vm.prank(alice);
        vault.deposit(298_124, alice);

        // Let the venue's share price climb away from 1:1.
        vm.warp(block.timestamp + 365 days);
        venue.accrue();

        uint256 priceBefore = _price();
        uint256 assetsBefore = vault.totalAssets();

        // Pull everything back, then put it straight out again -- the round
        // trip the fuzzer found.
        vm.startPrank(owner);
        vault.recallAll();
        vm.stopPrank();

        uint256 assetsIdle = vault.totalAssets();

        vm.prank(alice);
        vault.deposit(4, alice);

        uint256 assetsAfter = vault.totalAssets();
        uint256 priceAfter = _price();

        emit log_named_uint("venue share price (assets per 1e6 shares)", venue.convertToAssets(1e6));
        emit log_named_uint("vault assets, deployed ", assetsBefore);
        emit log_named_uint("vault assets, all idle ", assetsIdle);
        emit log_named_uint("vault assets, redeployed", assetsAfter);
        emit log_named_int("assets lost on the round trip", int256(assetsIdle + 4) - int256(assetsAfter));
        emit log_named_uint("share price before", priceBefore);
        emit log_named_uint("share price after ", priceAfter);
    }

    /// If the loss is one wei of rounding it cannot compound. If it is charged
    /// per deploy, it does -- and that is the difference between dust and a
    /// leak somebody can pump.
    function test_doesTheLossCompoundAcrossManyDeploys() public {
        vm.prank(alice);
        vault.deposit(100_000e6, alice);

        vm.warp(block.timestamp + 365 days);
        venue.accrue();

        uint256 start = _price();
        emit log_named_uint("share price at start", start);

        for (uint256 i; i < 50; ++i) {
            vm.prank(owner);
            vault.recallAll();
            vm.prank(alice);
            vault.deposit(1, alice);
        }

        uint256 end = _price();
        emit log_named_uint("share price after 50 recall+deploy cycles", end);
        emit log_named_int("drift", int256(end) - int256(start));
    }
}

/// @dev Is the fall a leak, or is it the fee doing exactly what it is for?
///      The performance fee is charged by MINTING shares to the fee recipient,
///      and minting shares against no new assets lowers the share price by
///      construction. If the drop equals 5% of the gain, nothing is leaking.
contract FeeVsLeakTest is Test {
    MockERC20 usdg;
    MockYieldVault venue;
    Safex vault;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        venue = new MockYieldVault(IERC20(address(usdg)), 700);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(venue)), "Safex", "sfx", owner);
        usdg.mint(alice, 1_000_000e6);
        vm.prank(alice);
        usdg.approve(address(vault), type(uint256).max);
    }

    function test_theFallIsTheFee() public {
        vm.prank(alice);
        vault.deposit(100_000e6, alice);

        vm.warp(block.timestamp + 365 days);
        venue.accrue();

        uint256 priceBeforeFee = vault.convertToAssets(1e12);
        uint256 gain = priceBeforeFee - 1e6; // above par
        uint256 feeShares0 = vault.balanceOf(vault.feeRecipient());

        // Any interaction accrues the fee.
        vm.prank(alice);
        vault.deposit(1e6, alice);

        uint256 priceAfterFee = vault.convertToAssets(1e12);
        uint256 minted = vault.balanceOf(vault.feeRecipient()) - feeShares0;

        emit log_named_uint("gain per share above par", gain);
        emit log_named_uint("price before fee accrual ", priceBeforeFee);
        emit log_named_uint("price after fee accrual  ", priceAfterFee);
        emit log_named_uint("drop                     ", priceBeforeFee - priceAfterFee);
        emit log_named_uint("5% of the gain           ", gain * 500 / 10_000);
        emit log_named_uint("fee shares minted        ", minted);

        assertGt(minted, 0, "no fee was charged");
        // The drop should be the fee, within rounding -- not more.
        assertApproxEqAbs(priceBeforeFee - priceAfterFee, gain * 500 / 10_000, 2, "drop is not the fee");
    }
}
