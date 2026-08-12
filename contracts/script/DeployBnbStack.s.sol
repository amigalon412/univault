// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {BnbChain} from "../src/BnbChain.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";
import {Safex} from "../src/Safex.sol";
import {BnbBasketAdapter} from "../src/BnbBasketAdapter.sol";
import {VenusERC4626Wrapper, IVToken} from "../src/VenusERC4626Wrapper.sol";
import {IPancakeV3Factory} from "../src/PancakeV3Executor.sol";

struct BnbStackConfig {
    address owner;
    address keeper;
    address sentinel;
    uint256 maxDeployPerCall;
    uint32 cooldown;
    string name;
    string symbol;
    /// @dev 10_000 leaves the vault entirely in the lending leg -- STEADY, and
    ///      the only configuration that needs no basket at all.
    uint16 targetStableBps;
}

struct BnbStack {
    PriceOracle oracle;
    KeeperGuard guard;
    Safex vault;
    BnbBasketAdapter basket;
}

/// @notice Deploys one BNB Chain strategy end to end.
///
/// @dev The BNB counterpart to DeployStack. Two differences carry all the
///      weight, and both come from what the chain actually offers:
///
///      1. THE LENDING VENUE IS WRAPPED. Safex takes an IERC4626 and checks
///         in its constructor that the venue's asset matches its own. Venus's
///         core USDT market is a Compound v2 vToken and is neither. The wrapper
///         is deployed once and shared by all three vaults -- it holds no
///         per-vault state, only vTokens, so a second one would split the
///         position for nothing.
///
///      2. THE BASKET IS FIVE NAMES, NOT EIGHT. A name has to exist here, have
///         a pool with depth, and have a Chainlink feed on this chain. Measured
///         against the live chain, exactly five clear all three; the reasoning
///         for each rejection is in BnbChain.sol. Two of the five are index
///         ETFs, which makes this a different product from the Robinhood build
///         and should be said in the copy rather than left for someone to
///         notice.
contract DeployBnbStack is Script {
    /// @dev 2_000 each across five names.
    uint16 internal constant WEIGHT_BPS = 2_000;

    /**
     * @notice Deploy all three strategies plus the shared lending wrapper.
     *
     * @dev One transaction batch, one broadcast, because the three vaults share
     *      the wrapper and deploying them separately would create three of them
     *      -- each holding its own vToken position for no reason.
     *
     *      No private key is read here. `startBroadcast()` with no argument
     *      takes the sender forge was given on the command line (`--account`
     *      against a keystore, or a hardware wallet), so the key never appears
     *      in a file, an environment variable or a shell history.
     *
     *      Run WITHOUT --broadcast first. Forge simulates the whole batch
     *      against a fork of the live chain and prints what it would cost; a
     *      wrong feed, a missing pool or a tier that names nothing all fail
     *      there, for free, instead of halfway through a real deployment.
     */
    function run() external returns (BnbStack memory steady, BnbStack memory balanced, BnbStack memory growth) {
        address owner = vm.envAddress("OWNER");
        address keeper = vm.envOr("KEEPER", address(0));
        address sentinel = vm.envOr("SENTINEL", address(0));
        // 50_000 USDT at eighteen decimals. The Robinhood default was 50_000e6.
        uint256 maxDeploy = vm.envOr("MAX_DEPLOY_PER_CALL", uint256(50_000e18));
        uint32 cooldown = uint32(vm.envOr("COOLDOWN", uint256(1 hours)));

        vm.startBroadcast();
        address deployer = msg.sender;

        VenusERC4626Wrapper lending = deployLending();

        steady = deploy(_cfg(owner, keeper, sentinel, maxDeploy, cooldown, "Safex Steady", "sfxSTEADY", 10_000), lending, deployer);
        balanced = deploy(_cfg(owner, keeper, sentinel, maxDeploy, cooldown, "Safex Balanced", "sfxBALANCED", 6_000), lending, deployer);
        growth = deploy(_cfg(owner, keeper, sentinel, maxDeploy, cooldown, "Safex Growth", "sfxGROWTH", 3_000), lending, deployer);

        vm.stopBroadcast();

        console2.log("lending wrapper", address(lending));
        console2.log("STEADY   vault ", address(steady.vault));
        console2.log("BALANCED vault ", address(balanced.vault));
        console2.log("BALANCED basket", address(balanced.basket));
        console2.log("GROWTH   vault ", address(growth.vault));
        console2.log("GROWTH   basket", address(growth.basket));
    }

    function _cfg(
        address owner,
        address keeper,
        address sentinel,
        uint256 maxDeploy,
        uint32 cooldown,
        string memory name,
        string memory symbol,
        uint16 stableBps
    ) internal pure returns (BnbStackConfig memory) {
        return BnbStackConfig({
            owner: owner,
            keeper: keeper,
            sentinel: sentinel,
            maxDeployPerCall: maxDeploy,
            cooldown: cooldown,
            name: name,
            symbol: symbol,
            targetStableBps: stableBps
        });
    }

    function deploy(BnbStackConfig memory cfg, VenusERC4626Wrapper lending, address deployer)
        public
        returns (BnbStack memory stack)
    {
        stack.oracle = new PriceOracle(deployer);
        stack.guard = new KeeperGuard(deployer, cfg.maxDeployPerCall, cfg.cooldown);
        stack.vault =
            new Safex(IERC20(BnbChain.USDT), IERC4626(address(lending)), cfg.name, cfg.symbol, deployer);

        stack.vault.setGuard(address(stack.guard));
        stack.guard.setVault(address(stack.vault), true);
        if (cfg.keeper != address(0)) stack.guard.setKeeper(cfg.keeper, true);
        if (cfg.sentinel != address(0)) stack.guard.setSentinel(cfg.sentinel, true);
        stack.vault.setFeeRecipient(cfg.owner);

        // A vault that is entirely stable has nothing to price and nothing to
        // trade, so it gets no basket rather than an empty one.
        if (cfg.targetStableBps < 10_000) {
            stack.basket = new BnbBasketAdapter(
                deployer,
                stack.oracle,
                address(stack.vault),
                BnbChain.USDT,
                IPancakeV3Factory(BnbChain.PANCAKE_V3_FACTORY)
            );
            _registerBasket(stack);
            stack.vault.setBasket(stack.basket, cfg.targetStableBps);
        }

        if (cfg.owner != deployer) {
            stack.vault.transferOwnership(cfg.owner);
            stack.guard.transferOwnership(cfg.owner);
            stack.oracle.transferOwnership(cfg.owner);
            if (address(stack.basket) != address(0)) {
                stack.basket.transferOwnership(cfg.owner);
            }
        }
    }

    /// @notice The shared lending wrapper. Deploy once, pass to every stack.
    function deployLending() public returns (VenusERC4626Wrapper) {
        return new VenusERC4626Wrapper(
            IERC20(BnbChain.USDT), IVToken(BnbChain.VUSDT), "Safex USDT (Venus)", "sfxUSDT"
        );
    }

    function _registerBasket(BnbStack memory stack) internal {
        address[5] memory tokens =
            [BnbChain.SPYB, BnbChain.QQQB, BnbChain.GOOGLB, BnbChain.MSFTB, BnbChain.METAB];
        address[5] memory feeds = [
            BnbChain.SPY_USD_FEED,
            BnbChain.QQQ_USD_FEED,
            BnbChain.GOOGL_USD_FEED,
            BnbChain.MSFT_USD_FEED,
            BnbChain.META_USD_FEED
        ];

        for (uint256 i = 0; i < tokens.length; i++) {
            // Equity feeds go quiet outside market hours, so the staleness
            // bound has to clear a weekend or the vault halts every Sunday.
            stack.oracle.setFeed(tokens[i], feeds[i], 3 days);
            stack.basket.addConstituent(tokens[i], WEIGHT_BPS);
            /* Order matters and is not cosmetic: setPoolFee rejects a token
               that is not a constituent yet. The same ordering trap cost a dry
               run on Robinhood Chain. */
            stack.basket.setPoolFee(tokens[i], BnbChain.poolFee(tokens[i]));
        }
    }
}
