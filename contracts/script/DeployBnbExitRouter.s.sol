// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {BnbExitRouter} from "../src/BnbExitRouter.sol";
import {BnbChain} from "../src/BnbChain.sol";
import {IPancakeV3Factory} from "../src/PancakeV3Executor.sol";

/// @notice Deploys the BNB Chain exit router — the contract behind the app's
///         "sell the whole position to USDT" button.
///
/// @dev A separate script from DeployExitRouter rather than a flag on it, for
///      the same reason BnbChain.sol is separate from RobinhoodChain.sol: the
///      Robinhood deployment is live and must keep building from its own
///      constants. That one takes a Uniswap v4 PoolManager; this one takes a
///      PancakeSwap v3 factory, and they are not interchangeable.
///
///      Ownerless and holding no funds, so there is nothing to configure after
///      the fact and nothing to lose if it is ever replaced. The route is not
///      baked in either — `_sellLeg` reads the fee tier off the basket adapter
///      on every call, which is what keeps it correct when the basket changes.
///
///      Run WITHOUT --broadcast first. Forge simulates against a fork of the
///      live chain and prints what it would cost; a wrong factory address fails
///      there, for free.
///
///      After it lands, put the address in the site's environment as
///      NEXT_PUBLIC_EXIT_ROUTER and REBUILD — the value is inlined at build
///      time, not read at start, so a restart alone changes nothing. Until then
///      the app hides the button rather than calling into an empty address.
contract DeployBnbExitRouter is Script {
    function run() external returns (BnbExitRouter router) {
        vm.startBroadcast();
        router = new BnbExitRouter(IPancakeV3Factory(BnbChain.PANCAKE_V3_FACTORY));
        vm.stopBroadcast();
        console2.log("bnbExitRouter :", address(router));
    }
}
