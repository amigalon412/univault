// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Safex} from "../src/Safex.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";

struct DeployConfig {
    address asset;
    address yieldVault;
    address owner;
    address keeper;
    address sentinel;
    uint256 maxDeployPerCall;
    uint32 cooldown;
    string name;
    string symbol;
}

/// @notice Deploys a vault and its guard, wired together.
/// @dev The wiring is the part worth getting right: a vault deployed without a
///      guard cannot be automated, and a guard that does not know its vault is
///      inert. `DeployTest` asserts the finished state rather than trusting the
///      script was run correctly.
contract Deploy is Script {
    function run() external returns (Safex vault, KeeperGuard guard) {
        DeployConfig memory cfg = DeployConfig({
            asset: vm.envAddress("ASSET"),
            yieldVault: vm.envAddress("YIELD_VAULT"),
            owner: vm.envAddress("OWNER"),
            keeper: vm.envOr("KEEPER", address(0)),
            sentinel: vm.envOr("SENTINEL", address(0)),
            maxDeployPerCall: vm.envOr("MAX_DEPLOY_PER_CALL", uint256(50_000e6)),
            cooldown: uint32(vm.envOr("COOLDOWN", uint256(1 hours))),
            name: vm.envOr("VAULT_NAME", string("Safex Steady")),
            symbol: vm.envOr("VAULT_SYMBOL", string("sfxSTEADY"))
        });

        vm.startBroadcast();
        (vault, guard) = deploy(cfg, msg.sender);
        vm.stopBroadcast();

        console2.log("vault           :", address(vault));
        console2.log("guard           :", address(guard));
        console2.log("asset           :", cfg.asset);
        console2.log("yield venue     :", cfg.yieldVault);
        console2.log("owner           :", cfg.owner);
        console2.log("keeper          :", cfg.keeper);
        console2.log("sentinel        :", cfg.sentinel);
        console2.log("cap per call    :", cfg.maxDeployPerCall);
        console2.log("cooldown (s)    :", cfg.cooldown);
    }

    /// @dev Deploys owned by `deployer`, wires everything, and only then hands
    ///      ownership over, so the deployment never passes through a state where
    ///      nobody can configure it.
    ///
    ///      `deployer` is explicit rather than read from `msg.sender`, which
    ///      differs between a broadcast and a plain call and would silently
    ///      leave the wiring calls coming from an address that owns nothing.
    function deploy(DeployConfig memory cfg, address deployer) public returns (Safex vault, KeeperGuard guard) {
        guard = new KeeperGuard(deployer, cfg.maxDeployPerCall, cfg.cooldown);
        vault = new Safex(IERC20(cfg.asset), IERC4626(cfg.yieldVault), cfg.name, cfg.symbol, deployer);

        vault.setGuard(address(guard));
        guard.setVault(address(vault), true);
        if (cfg.keeper != address(0)) guard.setKeeper(cfg.keeper, true);
        if (cfg.sentinel != address(0)) guard.setSentinel(cfg.sentinel, true);

        vault.setFeeRecipient(cfg.owner);

        if (cfg.owner != deployer) {
            vault.transferOwnership(cfg.owner);
            guard.transferOwnership(cfg.owner);
        }
    }
}
