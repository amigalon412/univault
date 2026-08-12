// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VenusERC4626Wrapper, IVToken} from "../src/VenusERC4626Wrapper.sol";
import {MockERC20} from "./mocks/Mocks.sol";

/// @dev A Compound v2 market, faithfully including the part that bites:
///      mint/redeem answer with an error CODE and do not revert.
contract MockVToken {
    MockERC20 public immutable token;
    uint256 public exchangeRateStored = 1e18;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupplyShares;

    /// @dev Set non-zero to make the next mint or redeem "fail" the Compound way.
    uint256 public mintError;
    uint256 public redeemError;
    /// @dev Cap on what can leave, standing in for a fully-utilised market.
    uint256 public cashCap = type(uint256).max;

    constructor(MockERC20 token_) {
        token = token_;
    }

    function underlying() external view returns (address) {
        return address(token);
    }

    function setMintError(uint256 e) external {
        mintError = e;
    }

    function setRedeemError(uint256 e) external {
        redeemError = e;
    }

    function setCashCap(uint256 c) external {
        cashCap = c;
    }

    /// @dev Interest, applied by hand so a test can move the rate.
    ///
    ///      The extra underlying is minted in as well, because that is where
    ///      interest comes from in a real market: borrowers repay it, and the
    ///      market's cash grows with the rate. Moving the rate alone models a
    ///      market that owes more than it holds -- and the wrapper correctly
    ///      refused to let anyone redeem against it, which is how this mock's
    ///      first version got caught.
    function accrue(uint256 bps) external {
        uint256 before = (totalSupplyShares * exchangeRateStored) / 1e18;
        exchangeRateStored = (exchangeRateStored * (10_000 + bps)) / 10_000;
        uint256 after_ = (totalSupplyShares * exchangeRateStored) / 1e18;
        if (after_ > before) token.mint(address(this), after_ - before);
    }

    function accrueInterest() external pure returns (uint256) {
        return 0;
    }

    function getCash() external view returns (uint256) {
        uint256 held = token.balanceOf(address(this));
        return held < cashCap ? held : cashCap;
    }

    function mint(uint256 amount) external returns (uint256) {
        if (mintError != 0) return mintError;
        token.transferFrom(msg.sender, address(this), amount);
        uint256 shares = (amount * 1e18) / exchangeRateStored;
        balanceOf[msg.sender] += shares;
        totalSupplyShares += shares;
        return 0;
    }

    function redeemUnderlying(uint256 amount) external returns (uint256) {
        if (redeemError != 0) return redeemError;
        uint256 shares = (amount * 1e18) / exchangeRateStored;
        balanceOf[msg.sender] -= shares;
        totalSupplyShares -= shares;
        token.transfer(msg.sender, amount);
        return 0;
    }
}

contract VenusERC4626WrapperTest is Test {
    MockERC20 usdt;
    MockVToken vToken;
    VenusERC4626Wrapper wrapper;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 18);
        vToken = new MockVToken(usdt);
        wrapper = new VenusERC4626Wrapper(IERC20(address(usdt)), IVToken(address(vToken)), "Safex USDT", "sfxUSDT");

        usdt.mint(alice, 1_000e18);
        usdt.mint(bob, 1_000e18);
        vm.prank(alice);
        usdt.approve(address(wrapper), type(uint256).max);
        vm.prank(bob);
        usdt.approve(address(wrapper), type(uint256).max);
    }

    /* ── the interface Safex demands ───────────────────────────────── */

    /// Safex's constructor rejects a venue whose asset does not match.
    function test_assetIsTheUnderlying() public view {
        assertEq(wrapper.asset(), address(usdt));
    }

    function test_constructorRejectsAMismatchedMarket() public {
        MockERC20 other = new MockERC20("Other", "OTHER", 18);
        vm.expectRevert(VenusERC4626Wrapper.UnderlyingMismatch.selector);
        new VenusERC4626Wrapper(IERC20(address(other)), IVToken(address(vToken)), "x", "x");
    }

    /* ── the trap: Compound returns codes, it does not revert ─────────── */

    /// A wrapper that ignored the return value would mint shares here against
    /// a deposit that never reached the market.
    function test_mintErrorCodeRevertsInsteadOfMintingShares() public {
        vToken.setMintError(13);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VenusERC4626Wrapper.VenusMintFailed.selector, 13));
        wrapper.deposit(100e18, alice);

        assertEq(wrapper.totalSupply(), 0, "shares minted against a failed deposit");
        assertEq(usdt.balanceOf(alice), 1_000e18, "assets moved anyway");
    }

    function test_redeemErrorCodeReverts() public {
        vm.prank(alice);
        wrapper.deposit(100e18, alice);

        vToken.setRedeemError(9);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VenusERC4626Wrapper.VenusRedeemFailed.selector, 9));
        wrapper.withdraw(50e18, alice, alice);
    }

    /* ── ordinary behaviour ───────────────────────────────────────────── */

    function test_depositLendsAndSharePriceFollowsInterest() public {
        vm.prank(alice);
        wrapper.deposit(100e18, alice);

        assertEq(wrapper.totalAssets(), 100e18);
        assertEq(usdt.balanceOf(address(vToken)), 100e18, "assets did not reach the market");
        assertEq(usdt.balanceOf(address(wrapper)), 0, "assets parked in the wrapper");

        vToken.accrue(500); // +5%
        assertApproxEqRel(wrapper.totalAssets(), 105e18, 1e12);

        /* Balance read BEFORE the prank: vm.prank applies to the very next
           call, and a staticcall in the argument list eats it. */
        uint256 shares = wrapper.balanceOf(alice);
        vm.prank(alice);
        uint256 got = wrapper.redeem(shares, alice, alice);
        assertApproxEqRel(got, 105e18, 1e12, "interest not paid out");
    }

    function test_twoDepositorsShareInterestProRata() public {
        vm.prank(alice);
        wrapper.deposit(100e18, alice);
        vm.prank(bob);
        wrapper.deposit(300e18, bob);

        vToken.accrue(1000); // +10%

        assertApproxEqRel(wrapper.maxWithdraw(alice), 110e18, 1e12);
        assertApproxEqRel(wrapper.maxWithdraw(bob), 330e18, 1e12);
    }

    /// A fully-utilised market has the assets but cannot hand them over this
    /// block. Safex reads maxWithdraw, so this must be the honest number.
    function test_maxWithdrawIsCappedByTheMarketsCash() public {
        vm.prank(alice);
        wrapper.deposit(100e18, alice);

        vToken.setCashCap(30e18);
        assertEq(wrapper.maxWithdraw(alice), 30e18, "reported more than the market can pay");
        assertEq(wrapper.maxRedeem(alice), wrapper.convertToShares(30e18));

        vm.prank(alice);
        wrapper.withdraw(30e18, alice, alice);
        assertEq(usdt.balanceOf(alice), 930e18);
    }

    function testFuzz_roundTripNeverPaysOutMoreThanWasLent(uint96 amount, uint16 bps) public {
        amount = uint96(bound(amount, 1e12, 1_000e18));
        bps = uint16(bound(bps, 0, 5_000));

        usdt.mint(alice, amount);
        vm.prank(alice);
        wrapper.deposit(amount, alice);
        vToken.accrue(bps);

        uint256 assets = wrapper.totalAssets();
        uint256 shares = wrapper.balanceOf(alice);
        vm.prank(alice);
        uint256 got = wrapper.redeem(shares, alice, alice);
        assertLe(got, assets, "paid out more than the position was worth");
    }
}
