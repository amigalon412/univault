// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {ExitRouter} from "../src/ExitRouter.sol";
import {RobinhoodChain} from "../src/RobinhoodChain.sol";

/// @notice Deploys the ExitRouter. It is ownerless and holds no funds, so there
///         is nothing to configure — the pool manager is the chain's singleton.
contract DeployExitRouter is Script {
    function run() external returns (ExitRouter router) {
        vm.startBroadcast();
        router = new ExitRouter(IPoolManager(RobinhoodChain.POOL_MANAGER));
        vm.stopBroadcast();
        console2.log("exitRouter :", address(router));
    }
}
