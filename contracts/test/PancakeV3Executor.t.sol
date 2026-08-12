// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PancakeV3Executor, IPancakeV3Factory} from "../src/PancakeV3Executor.sol";
import {MockERC20} from "./mocks/Mocks.sol";

interface ICallbackReceiver {
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}

/// @dev A v3 pool that fills at a fixed rate and, crucially, collects payment
///      through the callback the way the real one does.
contract MockV3Pool {
    MockERC20 public immutable token0;
    MockERC20 public immutable token1;
    /// @dev How many `tokenOut` per `tokenIn`, in 1e18 fixed point.
    uint256 public rate = 1e18;

    constructor(MockERC20 a, MockERC20 b) {
        (token0, token1) = address(a) < address(b) ? (a, b) : (b, a);
    }

    function setRate(uint256 r) external {
        rate = r;
    }

    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160, bytes calldata data)
        external
        returns (int256 amount0, int256 amount1)
    {
        uint256 amountIn = uint256(amountSpecified);
        uint256 amountOut = (amountIn * rate) / 1e18;

        MockERC20 tokenOut = zeroForOne ? token1 : token0;
        tokenOut.mint(recipient, amountOut);

        (amount0, amount1) = zeroForOne
            ? (int256(amountIn), -int256(amountOut))
            : (-int256(amountOut), int256(amountIn));

        ICallbackReceiver(msg.sender).pancakeV3SwapCallback(amount0, amount1, data);
    }
}

contract MockV3Factory is IPancakeV3Factory {
    mapping(bytes32 => address) internal pools;

    function set(address a, address b, uint24 fee, address pool) external {
        pools[_key(a, b, fee)] = pool;
    }

    function getPool(address a, address b, uint24 fee) external view returns (address) {
        return pools[_key(a, b, fee)];
    }

    function _key(address a, address b, uint24 fee) internal pure returns (bytes32) {
        (address x, address y) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encode(x, y, fee));
    }
}

/// @dev Exposes the internal swap so the test can drive it.
contract Harness is PancakeV3Executor {
    constructor(IPancakeV3Factory f) PancakeV3Executor(f) {}

    function swap(SwapRequest memory req) external returns (uint256) {
        return _executeSwap(req);
    }
}

contract PancakeV3ExecutorTest is Test {
    MockERC20 usdt;
    MockERC20 stock;
    MockV3Pool pool;
    MockV3Factory factory;
    Harness exec;

    uint24 constant FEE = 2500;

    function setUp() public {
        usdt = new MockERC20("Tether USD", "USDT", 18);
        stock = new MockERC20("Alphabet", "GOOGLB", 18);
        pool = new MockV3Pool(usdt, stock);
        factory = new MockV3Factory();
        factory.set(address(usdt), address(stock), FEE, address(pool));
        exec = new Harness(IPancakeV3Factory(address(factory)));
        usdt.mint(address(exec), 1_000e18);
    }

    function _req(uint256 amountIn, uint256 minOut) internal view returns (PancakeV3Executor.SwapRequest memory) {
        return PancakeV3Executor.SwapRequest({
            tokenIn: address(usdt),
            tokenOut: address(stock),
            fee: FEE,
            amountIn: amountIn,
            minAmountOut: minOut
        });
    }

    function test_swapsAndPaysThePool() public {
        uint256 got = exec.swap(_req(100e18, 0));

        assertEq(got, 100e18, "wrong amount out reported");
        assertEq(stock.balanceOf(address(exec)), 100e18, "output not received");
        assertEq(usdt.balanceOf(address(pool)), 100e18, "pool was not paid");
        assertEq(usdt.balanceOf(address(exec)), 900e18);
    }

    /// The floor is checked against what ARRIVED, not against a price limit.
    function test_revertsWhenOutputIsBelowTheFloor() public {
        pool.setRate(0.9e18);
        vm.expectRevert(abi.encodeWithSelector(PancakeV3Executor.InsufficientOutput.selector, 90e18, 95e18));
        exec.swap(_req(100e18, 95e18));
    }

    function test_revertsWhenThereIsNoPool() public {
        vm.expectRevert(
            abi.encodeWithSelector(PancakeV3Executor.PoolNotFound.selector, address(usdt), address(stock), uint24(10000))
        );
        exec.swap(
            PancakeV3Executor.SwapRequest({
                tokenIn: address(usdt),
                tokenOut: address(stock),
                fee: 10000,
                amountIn: 1e18,
                minAmountOut: 0
            })
        );
    }

    /* ── the callback is an entry point ───────────────────────────────── */

    /// An unauthenticated callback would let anyone name an amount and walk
    /// off with it. Outside a swap there is no active pool, so nobody passes.
    function test_callbackRejectsAnUninvitedCaller() public {
        vm.expectRevert(PancakeV3Executor.NotThePool.selector);
        exec.pancakeV3SwapCallback(int256(500e18), int256(0), abi.encode(address(usdt)));

        assertEq(usdt.balanceOf(address(exec)), 1_000e18, "funds left the contract");
    }

    /// Even a real pool cannot call in when this contract is not mid-swap with
    /// it -- the guard is cleared the moment the swap returns.
    function test_callbackRejectsARealPoolOutsideItsSwap() public {
        exec.swap(_req(10e18, 0));

        vm.prank(address(pool));
        vm.expectRevert(PancakeV3Executor.NotThePool.selector);
        exec.pancakeV3SwapCallback(int256(500e18), int256(0), abi.encode(address(usdt)));
    }

    function testFuzz_paysExactlyWhatThePoolAsksFor(uint96 amountIn, uint64 rate) public {
        amountIn = uint96(bound(amountIn, 1e12, 500e18));
        pool.setRate(bound(rate, 1e15, 5e18));

        uint256 before = usdt.balanceOf(address(exec));
        uint256 got = exec.swap(_req(amountIn, 0));

        assertEq(before - usdt.balanceOf(address(exec)), amountIn, "overpaid or underpaid the pool");
        assertEq(stock.balanceOf(address(exec)), got);
    }
}
