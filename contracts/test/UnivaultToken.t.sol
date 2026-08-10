// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";

import {UnivaultToken} from "../src/UnivaultToken.sol";
import {BuybackModule} from "../src/BuybackModule.sol";
import {MockERC20} from "./mocks/Mocks.sol";

/// @dev A module whose swap settles at a fixed rate, so this measures the
///      token and the retirement rather than a venue.
contract FixedRateBuyer is BuybackModule {
    constructor(address owner_, address stable_, address token_)
        BuybackModule(owner_, stable_, token_, IPoolManager(address(0)), true)
    {}

    function _executeSwap(SwapRequest memory req) internal override returns (uint256 amountOut) {
        amountOut = req.amountIn * 100 * 1e12;
        require(amountOut >= req.minAmountOut, "slippage");
        MockERC20(stable).burn(address(this), req.amountIn);
        // The seller's tokens, moved rather than conjured -- this token has no
        // mint, so a test that minted them would be testing something else.
        IERC20(token).transferFrom(seller(), address(this), amountOut);
    }

    function seller() public pure returns (address) {
        return address(uint160(uint256(keccak256("seller"))));
    }
}

contract UnivaultTokenTest is Test {
    UnivaultToken token;
    MockERC20 usdg;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice");
    address owner = makeAddr("owner");

    uint256 constant ONE = 1e6;

    function setUp() public {
        token = new UnivaultToken(deployer);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
    }

    // -----------------------------------------------------------------
    // Supply
    // -----------------------------------------------------------------

    function test_OneBillionMintedOnceToTheDeployer() public view {
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000e18);
        assertEq(token.balanceOf(deployer), 1_000_000_000e18, "not all of it went to one place");
        assertEq(token.decimals(), 18);
        // Pinned deliberately: name and symbol are set in the constructor and
        // ERC20 gives no way to change them afterwards, so whatever ships here
        // is what every wallet and explorer shows for the life of the token.
        assertEq(token.symbol(), "UNIVAULT");
        assertEq(token.name(), "UNIVAULT");
    }

    /// @dev The properties this token is chosen for are the absent ones, so they
    ///      are asserted by their absence rather than assumed from the source.
    function test_ThereIsNoOwnerNoMintNoPauseNoBlocklist() public {
        string[6] memory signatures = [
            "owner()",
            "mint(address,uint256)",
            "pause()",
            "unpause()",
            "blacklist(address)",
            "setFees(uint256,uint256)"
        ];

        for (uint256 i = 0; i < signatures.length; i++) {
            (bool ok,) = address(token).call(abi.encodeWithSignature(signatures[i]));
            assertFalse(ok, signatures[i]);
        }
    }

    // -----------------------------------------------------------------
    // Burning, which is the only way supply moves
    // -----------------------------------------------------------------

    function test_BurnReducesTotalSupply() public {
        vm.prank(deployer);
        token.transfer(alice, 1_000e18);

        vm.prank(alice);
        token.burn(400e18);

        assertEq(token.balanceOf(alice), 600e18);
        assertEq(token.totalSupply(), 1_000_000_000e18 - 400e18, "supply did not fall");
    }

    function test_BurnCannotReachAnotherHoldersBalance() public {
        vm.prank(deployer);
        token.transfer(alice, 1_000e18);

        // burnFrom needs an allowance, exactly as a transfer would.
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, owner, 0, 1_000e18)
        );
        token.burnFrom(alice, 1_000e18);
    }

    function test_BurningMoreThanHeldReverts() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, 0, 1e18)
        );
        token.burn(1e18);
    }

    // -----------------------------------------------------------------
    // It fits the module that will retire it
    // -----------------------------------------------------------------

    /// @dev The reason the token has `burn` at all. With it, a buyback removes
    ///      supply; without it the module could only park tokens at a dead
    ///      address, and the docs would have to say so.
    function test_ABuybackActuallyRemovesSupply() public {
        FixedRateBuyer module = new FixedRateBuyer(owner, address(usdg), address(token));

        vm.prank(owner);
        module.setPool(
            PoolKey({
                currency0: Currency.wrap(address(usdg) < address(token) ? address(usdg) : address(token)),
                currency1: Currency.wrap(address(usdg) < address(token) ? address(token) : address(usdg)),
                fee: 3000,
                tickSpacing: 60,
                hooks: IHooks(address(0))
            })
        );

        // Stand in for a pool holding the sell side.
        address seller = module.seller();
        vm.prank(deployer);
        token.transfer(seller, 10_000_000e18);
        vm.prank(seller);
        token.approve(address(module), type(uint256).max);

        usdg.mint(address(module), 1_000 * ONE);
        uint256 supplyBefore = token.totalSupply();

        vm.prank(owner);
        uint256 retired = module.buyback(type(uint256).max, 1);

        assertEq(retired, 1_000 * 100 * 1e18, "bought the wrong amount");
        assertEq(token.totalSupply(), supplyBefore - retired, "supply did not fall by what was bought");
        assertEq(token.balanceOf(address(module)), 0, "module kept some back");
        assertEq(module.totalRetired(), retired);
        assertTrue(module.burnsSupply());
    }
}
