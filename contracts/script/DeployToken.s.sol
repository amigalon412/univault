// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {UnivaultToken} from "../src/UnivaultToken.sol";

/// @notice Deploys BLUR. One transaction, no configuration, nothing to get
///         wrong afterwards -- the supply is fixed at construction and there is
///         no owner to hand over.
///
/// @dev The whole supply goes to `RECIPIENT`, which then has to seed the pool.
///      Nothing about that is enforceable on-chain; it is a thing the deployer
///      does or does not do, and holders can check the balance either way.
contract DeployToken is Script {
    function run() external returns (UnivaultToken token) {
        address recipient = vm.envOr("RECIPIENT", msg.sender);

        vm.startBroadcast();
        token = new UnivaultToken(recipient);
        vm.stopBroadcast();

        console2.log("token     :", address(token));
        console2.log("recipient :", recipient);
        console2.log("supply    :", token.totalSupply());
    }
}
