// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {BnbChain} from "../src/BnbChain.sol";
import {VenusERC4626Wrapper, IVToken} from "../src/VenusERC4626Wrapper.sol";
import {PancakeV3Executor, IPancakeV3Factory} from "../src/PancakeV3Executor.sol";
import {DeployBnbStack, BnbStackConfig, BnbStack} from "../script/DeployBnbStack.s.sol";
import {VenusERC4626Wrapper as Lending} from "../src/VenusERC4626Wrapper.sol";

interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract Swapper is PancakeV3Executor {
    constructor(IPancakeV3Factory f) PancakeV3Executor(f) {}

    function swap(SwapRequest memory req) external returns (uint256) {
        return _executeSwap(req);
    }
}

/**
 * @dev Every external assumption the BNB port rests on, checked against the
 *      live chain rather than against a mock of it.
 *
 *      The unit tests prove the contracts behave; this proves the world they
 *      were written for exists. Each address in BnbChain.sol was read off the
 *      chain once, by hand, while the port was being planned -- this is what
 *      keeps it true afterwards. A ticker whose pool drains or whose feed goes
 *      stale should fail here, loudly, and not on a depositor's money.
 *
 *      Run:  forge test --match-path 'test/BnbStack.fork.t.sol' -vv
 */
contract BnbStackForkTest is Test {
    address constant ALICE = address(0xA11CE);

    /// @dev 24h plus a wide margin. These feeds are 24/5 -- they legitimately
    ///      go quiet over a weekend, so a tighter bound would fail on Sundays
    ///      for a reason that has nothing to do with the port.
    uint256 constant MAX_FEED_AGE = 4 days;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BSC_RPC", vm.rpcUrl("bsc")));
        assertEq(block.chainid, BnbChain.CHAIN_ID, "not BNB Chain");
    }

    /* ── the stablecoin ───────────────────────────────────────────────── */

    /// Eighteen decimals, not six. The port's likeliest silent bug.
    function test_usdtIsEighteenDecimals() public view {
        assertEq(IERC20Metadata(BnbChain.USDT).decimals(), BnbChain.USDT_DECIMALS);
        assertEq(IERC20Metadata(BnbChain.USDT).decimals(), 18);
    }

    /* ── the lending leg ──────────────────────────────────────────────── */

    /// The wrapper against the real Venus market: lend, accrue, redeem.
    function test_venusWrapperRoundTripsAgainstTheLiveMarket() public {
        VenusERC4626Wrapper wrapper = new VenusERC4626Wrapper(
            IERC20(BnbChain.USDT), IVToken(BnbChain.VUSDT), "Safex USDT", "sfxUSDT"
        );
        assertEq(wrapper.asset(), BnbChain.USDT, "wrapper points at the wrong asset");

        uint256 amount = 10_000e18;
        deal(BnbChain.USDT, ALICE, amount);

        vm.startPrank(ALICE);
        IERC20(BnbChain.USDT).approve(address(wrapper), amount);
        uint256 shares = wrapper.deposit(amount, ALICE);
        vm.stopPrank();

        assertGt(shares, 0, "no shares minted");
        assertApproxEqRel(wrapper.totalAssets(), amount, 0.001e18, "assets did not reach the market");
        assertEq(IERC20(BnbChain.USDT).balanceOf(address(wrapper)), 0, "assets parked in the wrapper");

        // Let the market accrue, then take it all back out.
        vm.roll(block.number + 100_000);
        vm.warp(block.timestamp + 3 days);

        uint256 max = wrapper.maxWithdraw(ALICE);
        assertGe(max, (amount * 999) / 1000, "market cannot return the deposit");

        /* Shares read BEFORE the prank -- a staticcall in the argument list
           consumes it, and `redeem` would then be called by this test contract,
           which holds no allowance over Alice's shares. */
        uint256 aliceShares = wrapper.balanceOf(ALICE);
        vm.prank(ALICE);
        uint256 got = wrapper.redeem(aliceShares, ALICE, ALICE);
        assertGe(got, (amount * 999) / 1000, "round trip lost more than rounding");
        emit log_named_decimal_uint("USDT back after 3 days", got, 18);
    }

    /// The market has to be deep enough that the stable leg is not the whole of
    /// it. A venue this vault could dominate is a venue it cannot exit.
    function test_venusUsdtMarketIsDeep() public {
        uint256 cash = IVToken(BnbChain.VUSDT).getCash();
        emit log_named_decimal_uint("Venus vUSDT cash", cash, 18);
        assertGt(cash, 1_000_000e18, "lending venue is too shallow to use");
    }

    /* ── the price feeds ──────────────────────────────────────────────── */

    /// Eight decimals, a positive answer and a recent update, for all five.
    /// PriceOracle halts the vault on a stale feed, so a feed that has quietly
    /// stopped is the difference between a working product and a frozen one.
    function test_everyBasketFeedIsLiveAndFresh() public {
        address[5] memory feeds = [
            BnbChain.SPY_USD_FEED,
            BnbChain.QQQ_USD_FEED,
            BnbChain.GOOGL_USD_FEED,
            BnbChain.MSFT_USD_FEED,
            BnbChain.META_USD_FEED
        ];
        for (uint256 i; i < feeds.length; i++) {
            IAggregatorV3 f = IAggregatorV3(feeds[i]);
            (, int256 answer,, uint256 updatedAt,) = f.latestRoundData();
            assertEq(f.decimals(), 8, "feed is not 8 decimals");
            assertGt(answer, 0, "feed answers zero or negative");
            assertLe(block.timestamp - updatedAt, MAX_FEED_AGE, "feed is stale");
            emit log_named_decimal_uint(f.description(), uint256(answer), 8);
        }
    }

    /* ── the venue ────────────────────────────────────────────────────── */

    /// Every basket name must have a pool at the tier BnbChain names for it.
    /// This is the check the first ExitRouter did not have, and the reason a
    /// grown basket took the whole exit down on the other chain.
    function test_everyBasketNameHasAPoolAtItsNamedTier() public {
        address[5] memory tokens =
            [BnbChain.SPYB, BnbChain.QQQB, BnbChain.GOOGLB, BnbChain.MSFTB, BnbChain.METAB];
        for (uint256 i; i < tokens.length; i++) {
            uint24 fee = BnbChain.poolFee(tokens[i]);
            address pool = IPancakeV3Factory(BnbChain.PANCAKE_V3_FACTORY).getPool(tokens[i], BnbChain.USDT, fee);
            assertTrue(pool != address(0), "no pool at the named tier");
            uint256 depth = IERC20(BnbChain.USDT).balanceOf(pool);
            emit log_named_decimal_uint(IERC20Metadata(tokens[i]).symbol(), depth, 18);
            assertGt(depth, 5_000e18, "pool too thin to route through");
        }
    }

    /// A real swap through a real pool, priced against the real feed. This is
    /// the one test that would catch a fee tier that is right but empty.
    function test_buysGooglThroughPancakeAtRoughlyTheOraclePrice() public {
        Swapper swapper = new Swapper(IPancakeV3Factory(BnbChain.PANCAKE_V3_FACTORY));

        uint256 spend = 1_000e18; // 1,000 USDT
        deal(BnbChain.USDT, address(swapper), spend);

        uint256 got = swapper.swap(
            PancakeV3Executor.SwapRequest({
                tokenIn: BnbChain.USDT,
                tokenOut: BnbChain.GOOGLB,
                fee: BnbChain.poolFee(BnbChain.GOOGLB),
                amountIn: spend,
                minAmountOut: 0
            })
        );

        assertGt(got, 0, "swap returned nothing");
        assertEq(IERC20(BnbChain.GOOGLB).balanceOf(address(swapper)), got);
        assertEq(IERC20(BnbChain.USDT).balanceOf(address(swapper)), 0, "did not spend the input");

        (, int256 answer,,,) = IAggregatorV3(BnbChain.GOOGL_USD_FEED).latestRoundData();
        uint256 oraclePrice = uint256(answer) * 1e10; // 8dp -> 18dp
        uint256 paid = (spend * 1e18) / got; // USDT per whole GOOGLB, 18dp

        emit log_named_decimal_uint("oracle GOOGL/USD", oraclePrice, 18);
        emit log_named_decimal_uint("paid per GOOGLB ", paid, 18);

        /* Five per cent covers the fee, the spread and the impact of a $1,000
           order. Wider than that and the pool is not tracking the share, which
           is exactly the failure this basket was picked to avoid. */
        assertApproxEqRel(paid, oraclePrice, 0.05e18, "pool price is off the oracle");
    }
}


/// @dev The whole thing, deployed on a fork and made to take a real deposit.
///
///      This is the test the port is for. It proves the three vaults the
///      product is actually made of can be stood up on BNB Chain against live
///      Venus, live Chainlink and live PancakeSwap -- and, incidentally, that
///      nothing in the contracts assumed a six-decimal stablecoin, because
///      every figure here is eighteen.
contract BnbDeployForkTest is Test {
    DeployBnbStack deployer;
    Lending lending;
    address constant OWNER = address(0x0e0);
    address constant BOB = address(0xB0B);

    function setUp() public {
        vm.createSelectFork(vm.envOr("BSC_RPC", vm.rpcUrl("bsc")));
        deployer = new DeployBnbStack();
        lending = deployer.deployLending();
    }

    function _cfg(string memory name, string memory symbol, uint16 stableBps)
        internal
        view
        returns (BnbStackConfig memory)
    {
        return BnbStackConfig({
            owner: OWNER,
            keeper: address(0),
            sentinel: address(0),
            maxDeployPerCall: 1_000_000e18,
            cooldown: 0,
            name: name,
            symbol: symbol,
            targetStableBps: stableBps
        });
    }

    /// The three pools, exactly as specified: all yield, 60/40, 30/70.
    function test_deploysAllThreeStrategies() public {
        BnbStack memory steady = deployer.deploy(_cfg("Safex Steady", "sfxSTEADY", 10_000), lending, address(deployer));
        BnbStack memory balanced =
            deployer.deploy(_cfg("Safex Balanced", "sfxBALANCED", 6_000), lending, address(deployer));
        BnbStack memory growth = deployer.deploy(_cfg("Safex Growth", "sfxGROWTH", 3_000), lending, address(deployer));

        assertEq(address(steady.basket), address(0), "STEADY should have no basket");
        assertEq(balanced.basket.tokensLength(), 5, "BALANCED basket is not five names");
        assertEq(growth.basket.tokensLength(), 5, "GROWTH basket is not five names");
        /* Shares are 24 decimals here, not 18: ERC4626's inflation-attack
           offset is 6, and it is added to the ASSET's decimals. On Robinhood
           Chain the asset was 6dp so shares were 12dp; USDT is 18dp so shares
           are 24dp. Nothing in the contracts assumed either -- but anything
           off-chain that hard-coded 12 will be wrong by a million-fold, which
           is the kind of error that looks like a working number. */
        assertEq(IERC20Metadata(BnbChain.USDT).decimals(), 18, "USDT is not 18dp");
        assertEq(steady.vault.decimals(), 24, "share decimals are not asset + offset");
        assertTrue(balanced.basket.isValuable(), "basket cannot be priced");
    }

    /// A real deposit into GROWTH: lends 30%, buys five bStocks with 70%.
    function test_growthDepositSplitsAndBuysTheBasket() public {
        BnbStack memory growth = deployer.deploy(_cfg("Safex Growth", "sfxGROWTH", 3_000), lending, address(deployer));

        uint256 amount = 5_000e18;
        deal(BnbChain.USDT, BOB, amount);

        vm.startPrank(BOB);
        IERC20(BnbChain.USDT).approve(address(growth.vault), amount);
        growth.vault.deposit(amount, BOB);
        vm.stopPrank();

        // Every name should now be held, and the whole position priced.
        (address[] memory tokens, uint256[] memory balances) = growth.basket.holdings();
        uint256 held;
        for (uint256 i; i < tokens.length; i++) {
            emit log_named_decimal_uint(IERC20Metadata(tokens[i]).symbol(), balances[i], 18);
            if (balances[i] > 0) held++;
        }
        assertEq(held, 5, "not every name was bought");

        uint256 total = growth.vault.totalAssets();
        emit log_named_decimal_uint("totalAssets after deposit", total, 18);
        /* Three per cent covers five pool fees, five spreads and the impact of
           a $5,000 order spread across them. Wider than that and the basket is
           too thin for this size, which is a sizing decision, not a bug. */
        assertApproxEqRel(total, amount, 0.03e18, "deposit lost more than the round trip should cost");
    }
}
