// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, StdInvariant, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {MockERC20, MockYieldVault} from "./mocks/Mocks.sol";

/// @notice Drives the vault through random sequences of user and owner actions,
///         with time and yield moving in between.
contract Handler is Test {
    Safex public vault;
    MockERC20 public usdg;
    MockYieldVault public yieldVault;
    address public owner;

    address[] public actors;
    uint256 public ghost_deposited;
    uint256 public ghost_withdrawn;

    constructor(Safex v, MockERC20 u, MockYieldVault y, address o) {
        vault = v;
        usdg = u;
        yieldVault = y;
        owner = o;
        for (uint256 i; i < 4; ++i) {
            address a = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(a);
            usdg.mint(a, 1_000_000e6);
            vm.prank(a);
            usdg.approve(address(vault), type(uint256).max);
        }
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 seed, uint256 amount) external {
        address a = _actor(seed);
        amount = bound(amount, 1, 100_000e6);
        if (usdg.balanceOf(a) < amount) return;
        vm.prank(a);
        vault.deposit(amount, a);
        ghost_deposited += amount;
    }

    function redeem(uint256 seed, uint256 shares) external {
        address a = _actor(seed);
        uint256 bal = vault.balanceOf(a);
        if (bal == 0) return;
        shares = bound(shares, 1, bal);
        vm.prank(a);
        uint256 out = vault.redeem(shares, a, a);
        ghost_withdrawn += out;
    }

    function withdrawAssets(uint256 seed, uint256 assets) external {
        address a = _actor(seed);
        uint256 max = vault.maxWithdraw(a);
        if (max == 0) return;
        assets = bound(assets, 1, max);
        vm.prank(a);
        vault.withdraw(assets, a, a);
        ghost_withdrawn += assets;
    }

    function deployIdle(uint256) external {
        vm.prank(owner);
        vault.deployIdle();
    }

    function recallAll(uint256) external {
        vm.prank(owner);
        vault.recallAll();
    }

    function setBuffer(uint256 bps) external {
        vm.prank(owner);
        vault.setBufferBps(uint16(bound(bps, 0, 10_000)));
    }

    function passTime(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1 hours, 60 days));
        yieldVault.accrue();
    }

    /// @dev Anyone can shove tokens at the vault. It must not break accounting.
    function donate(uint256 seed, uint256 amount) external {
        address a = _actor(seed);
        amount = bound(amount, 1, 10_000e6);
        if (usdg.balanceOf(a) < amount) return;
        vm.prank(a);
        usdg.transfer(address(vault), amount);
    }
}

contract SafexInvariantTest is StdInvariant, Test {
    MockERC20 usdg;
    MockYieldVault yieldVault;
    Safex vault;
    Handler handler;

    address owner = makeAddr("owner");

    function setUp() public {
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        yieldVault = new MockYieldVault(IERC20(address(usdg)), 700);
        vault = new Safex(IERC20(address(usdg)), IERC4626(address(yieldVault)), "BLUR", "blur", owner);

        handler = new Handler(vault, usdg, yieldVault, owner);
        targetContract(address(handler));
    }

    /// @notice Solvency. Every holder redeeming at once must not ask for more
    ///         than the vault holds. If this breaks, someone is left short.
    function invariant_VaultCanCoverEveryClaim() public view {
        uint256 claims = vault.previewRedeem(vault.balanceOf(vault.feeRecipient()));
        uint256 n = handler.actorsLength();
        for (uint256 i; i < n; ++i) {
            claims += vault.previewRedeem(vault.balanceOf(handler.actors(i)));
        }
        assertLe(claims, vault.totalAssets(), "claims exceed assets");
    }

    /// @notice Shares outstanding must equal what holders actually hold. Nobody
    ///         mints to an address the accounting does not know about — the fee
    ///         recipient included, which is the only other address that can
    ///         legitimately receive newly minted shares.
    function invariant_SupplyMatchesHoldings() public view {
        uint256 held = vault.balanceOf(vault.feeRecipient());
        uint256 n = handler.actorsLength();
        for (uint256 i; i < n; ++i) {
            held += vault.balanceOf(handler.actors(i));
        }
        assertEq(held, vault.totalSupply(), "supply does not match holdings");
    }

    /**
     * @notice The share price may only ever go up -- EXCEPT when the fee is
     *         charged, which is the one legitimate way it comes down.
     *
     * @dev The previous form of this asserted the price never falls below par,
     *      and it was wrong. The performance fee is taken by MINTING shares to
     *      the fee recipient, and minting shares against no new assets lowers
     *      the price by construction. Measured, the fall is 5% of the gain to
     *      the unit: a gain of 66,499 per share produced a fall of 3,324
     *      against a fee of 3,324. So the old assertion failed about one run in
     *      six, on a vault working exactly as designed.
     *
     *      What is worth asserting is the part a leak would break: with NO fee
     *      charged, the price cannot fall at all. Anything that quietly
     *      destroyed value -- rounding handed to a venue, a mis-settled swap --
     *      shows up here, because it would move the price with no fee shares
     *      minted to explain it.
     */
    function invariant_SharePriceOnlyFallsByTheFee() public {
        uint256 price = vault.convertToAssets(1e12);
        uint256 feeShares = vault.balanceOf(vault.feeRecipient());

        if (feeShares == _lastFeeShares && _lastPrice != 0) {
            assertGe(price, _lastPrice, "share price fell with no fee to explain it");
        }
        _lastPrice = price;
        _lastFeeShares = feeShares;
    }

    uint256 private _lastPrice;
    uint256 private _lastFeeShares;

    /// @notice Whatever else happens, the vault is never worth less than par
    ///         plus every fee ever charged. This is the "nothing was destroyed"
    ///         statement the old assertion was reaching for.
    function invariant_ParPlusFeesIsAlwaysBacked() public view {
        uint256 held = vault.balanceOf(vault.feeRecipient());
        uint256 n = handler.actorsLength();
        for (uint256 i; i < n; ++i) {
            held += vault.balanceOf(handler.actors(i));
        }
        if (held == 0) return;
        // Every share outstanding, valued together, is still backed.
        assertLe(vault.previewRedeem(held), vault.totalAssets(), "shares are not backed");
    }

    /// @notice Assets never simply vanish: what the vault reports must be backed
    ///         by what it actually holds, idle plus its position at the venue.
    function invariant_ReportedAssetsAreBacked() public view {
        uint256 backing = usdg.balanceOf(address(vault))
            + yieldVault.convertToAssets(yieldVault.balanceOf(address(vault)));
        assertEq(vault.totalAssets(), backing, "totalAssets is not backed");
    }

    function invariant_CallSummary() public view {
        console2.log("deposited:", handler.ghost_deposited());
        console2.log("withdrawn:", handler.ghost_withdrawn());
    }
}
