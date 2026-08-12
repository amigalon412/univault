// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPancakeV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IPancakeV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);
}

/// @title PancakeV3Executor
/// @notice Exact-input swaps through PancakeSwap v3.
///
/// @dev The BNB Chain counterpart to SwapExecutor, and a replacement rather
///      than a subclass because the two venues are shaped differently. Uniswap
///      v4 is a singleton: you ask it to `unlock`, it calls you back, and inside
///      that one callback you swap and settle a net balance delta. PancakeSwap
///      v3 is a Uniswap V3 fork: a separate pool contract per pair-and-tier,
///      and `swap` calls the payer back mid-execution to collect what is owed.
///      Nothing of the v4 settle/take dance survives the translation.
///
///      Uniswap v4 IS deployed on BNB Chain, so this could have been a rename
///      -- except that no tokenised equity trades there. Every pool with real
///      depth is PancakeSwap v3.
abstract contract PancakeV3Executor {
    using SafeERC20 for IERC20;

    struct SwapRequest {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 minAmountOut;
    }

    /// @dev The bounds of a v3 price range. Uniswap's TickMath constants; the
    ///      fork keeps them.
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    IPancakeV3Factory public immutable factory;

    /// @dev Set only for the duration of one swap, so the callback knows which
    ///      pool it is allowed to answer. Cleared before `_executeSwap`
    ///      returns -- an unset value is what makes an uninvited callback fail.
    ///
    ///      Ordinary storage, not `transient`: that keyword needs Solidity
    ///      0.8.28 and this build is pinned to 0.8.26, and the underlying
    ///      EIP-1153 opcodes need the chain to be on a fork that has them.
    ///      Neither is worth a gas refund here. A revert unwinds this the same
    ///      as transient storage would, so the guard cannot be left armed.
    address private _activePool;

    error NotThePool();
    error PoolNotFound(address tokenIn, address tokenOut, uint24 fee);
    error InsufficientOutput(uint256 received, uint256 minimum);
    error NothingReceived();

    constructor(IPancakeV3Factory factory_) {
        factory = factory_;
    }

    /// @notice Swap `amountIn` of `tokenIn` for at least `minAmountOut`.
    /// @dev Virtual so a test can substitute a deterministic fill and measure
    ///      the decision around the swap rather than the venue.
    function _executeSwap(SwapRequest memory req) internal virtual returns (uint256 amountOut) {
        address pool = factory.getPool(req.tokenIn, req.tokenOut, req.fee);
        if (pool == address(0)) revert PoolNotFound(req.tokenIn, req.tokenOut, req.fee);

        bool zeroForOne = req.tokenIn < req.tokenOut;

        _activePool = pool;
        /* Positive amountSpecified is exact input. The price limit is pushed to
           the extreme on purpose: a limit short of that stops the swap early
           and returns a PARTIAL fill, which reads as success. The real bound is
           minAmountOut, checked below against what actually arrived. */
        (int256 amount0, int256 amount1) = IPancakeV3Pool(pool).swap(
            address(this),
            zeroForOne,
            int256(req.amountIn),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(req.tokenIn)
        );
        _activePool = address(0);

        /* The pool reports what it took as positive and what it paid as
           negative, from its own point of view. */
        int256 out = zeroForOne ? amount1 : amount0;
        if (out >= 0) revert NothingReceived();

        amountOut = uint256(-out);
        if (amountOut < req.minAmountOut) revert InsufficientOutput(amountOut, req.minAmountOut);
    }

    /**
     * @notice Pay the pool what the swap owes it.
     *
     * @dev Authentication is the whole of this function. A callback is an
     *      entry point, and an unauthenticated one here would let anyone call
     *      it directly and drain this contract by naming an amount.
     *
     *      The guard is `_activePool`, set immediately before the swap and
     *      cleared immediately after, so the only caller that passes is the one
     *      pool this contract is mid-swap with. Uniswap's own periphery instead
     *      recomputes the pool address with CREATE2 and the factory's init code
     *      hash -- which works, but bakes in a hash that differs between
     *      Uniswap and every fork of it, and is a well-known way to ship a
     *      router that authenticates against the wrong venue. Transient storage
     *      needs no such constant and cannot be got wrong by copying.
     */
    function pancakeV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        if (msg.sender != _activePool || _activePool == address(0)) revert NotThePool();

        address tokenIn = abi.decode(data, (address));
        int256 owed = amount0Delta > 0 ? amount0Delta : amount1Delta;
        if (owed > 0) IERC20(tokenIn).safeTransfer(msg.sender, uint256(owed));
    }
}
