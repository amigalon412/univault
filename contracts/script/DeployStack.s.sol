// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {BasketAdapter} from "../src/BasketAdapter.sol";
import {Univault} from "../src/Univault.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {RobinhoodChain} from "../src/RobinhoodChain.sol";

struct StackConfig {
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

struct Stack {
    PriceOracle oracle;
    KeeperGuard guard;
    Univault vault;
    BasketAdapter basket;
}

/// @notice Deploys one strategy end to end: oracle, guard, vault and basket,
///         wired together and handed to the owner.
///
/// @dev The existing Deploy script covers only the lending leg. Running it and
///      calling the result finished would leave a vault that can never hold a
///      stock token, because the basket is constructed against the vault and
///      has to be registered back on it.
///
///      Feeds and pools come from RobinhoodChain, where each address was read
///      on-chain, rather than from environment variables. A mistyped feed is
///      not something an operator should be able to introduce at deploy time.
contract DeployStack is Script {
    function run() external returns (Stack memory stack) {
        StackConfig memory cfg = StackConfig({
            owner: vm.envAddress("OWNER"),
            keeper: vm.envOr("KEEPER", address(0)),
            sentinel: vm.envOr("SENTINEL", address(0)),
            maxDeployPerCall: vm.envOr("MAX_DEPLOY_PER_CALL", uint256(50_000e6)),
            cooldown: uint32(vm.envOr("COOLDOWN", uint256(1 hours))),
            name: vm.envOr("VAULT_NAME", string("Univault Balanced")),
            symbol: vm.envOr("VAULT_SYMBOL", string("uvBALANCED")),
            targetStableBps: uint16(vm.envOr("TARGET_STABLE_BPS", uint256(6_000)))
        });

        vm.startBroadcast();
        stack = deploy(cfg, msg.sender);
        vm.stopBroadcast();

        console2.log("oracle      :", address(stack.oracle));
        console2.log("guard       :", address(stack.guard));
        console2.log("vault       :", address(stack.vault));
        console2.log("basket      :", address(stack.basket));
        console2.log("owner       :", cfg.owner);
        console2.log("keeper      :", cfg.keeper);
        console2.log("stable bps  :", cfg.targetStableBps);
    }

    /// @dev `deployer` is explicit rather than read from `msg.sender`, which
    ///      differs between a broadcast and a plain call and would leave the
    ///      wiring calls coming from an address that owns nothing.
    function deploy(StackConfig memory cfg, address deployer) public returns (Stack memory stack) {
        stack.oracle = new PriceOracle(deployer);
        stack.guard = new KeeperGuard(deployer, cfg.maxDeployPerCall, cfg.cooldown);
        stack.vault = new Univault(
            IERC20(RobinhoodChain.USDG), IERC4626(RobinhoodChain.STEAK_USDG), cfg.name, cfg.symbol, deployer
        );

        stack.vault.setGuard(address(stack.guard));
        stack.guard.setVault(address(stack.vault), true);
        if (cfg.keeper != address(0)) stack.guard.setKeeper(cfg.keeper, true);
        if (cfg.sentinel != address(0)) stack.guard.setSentinel(cfg.sentinel, true);
        stack.vault.setFeeRecipient(cfg.owner);

        // A vault that is entirely stable has nothing to price and nothing to
        // trade, so it gets no basket rather than an empty one.
        if (cfg.targetStableBps < 10_000) {
            stack.basket = new BasketAdapter(
                deployer,
                stack.oracle,
                address(stack.vault),
                RobinhoodChain.USDG,
                IPoolManager(RobinhoodChain.POOL_MANAGER)
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

    /// @dev Four names, evenly weighted. AMD is deliberately absent: its 0.30%
    ///      USDG pool carries a hook and holds no liquidity, so it cannot be
    ///      traded the way the other four are.
    function _registerBasket(Stack memory stack) internal {
        address[4] memory tokens = [RobinhoodChain.NVDA, RobinhoodChain.AAPL, RobinhoodChain.TSLA, RobinhoodChain.AMZN];
        address[4] memory feeds = [
            RobinhoodChain.NVDA_USD_FEED,
            RobinhoodChain.AAPL_USD_FEED,
            RobinhoodChain.TSLA_USD_FEED,
            RobinhoodChain.AMZN_USD_FEED
        ];

        for (uint256 i = 0; i < tokens.length; i++) {
            // Equity feeds go quiet outside market hours, so the staleness
            // bound has to clear a weekend or the vault halts every Sunday.
            stack.oracle.setFeed(tokens[i], feeds[i], 3 days);
            stack.basket.addConstituent(tokens[i], 2_500);
            stack.basket.setPool(tokens[i], RobinhoodChain.basketPool(tokens[i]));
        }
    }
}
