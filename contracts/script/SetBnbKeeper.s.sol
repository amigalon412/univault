// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {KeeperGuard} from "../src/KeeperGuard.sol";

/// @notice Registers (or revokes) one keeper address on all three BNB guards.
///
/// @dev Three `cast send` calls would do the same thing and prompt for the
///      keystore password three times. This is one broadcast and one prompt,
///      which matters less for convenience than for not having a half-applied
///      state: a keeper registered on two guards out of three drives two vaults
///      and silently leaves the third to drift.
///
///      Usage:
///        KEEPER=0x... forge script script/SetBnbKeeper.s.sol:SetBnbKeeper \
///          --rpc-url https://bsc-dataseed.binance.org --account univault-owner
///
///      Add --broadcast when the simulation looks right. To revoke, add
///      ALLOWED=false — that is the kill switch, and it works whether or not
///      the machine running the keeper cooperates.
contract SetBnbKeeper is Script {
    /* contracts/DEPLOYMENTS.md, BNB Chain section. */
    address constant G_STEADY = 0x4FB1425bAe5E05C7De959B1bBDdA49ce6DEFCf8A;
    address constant G_BALANCED = 0xB6312EcAA70B72f2cbec53741A7D2FF5Bdb217CE;
    address constant G_GROWTH = 0x8caB9f8c22AF2823485ef3aBc9eDFE99a72B212B;

    function run() external {
        address keeper = vm.envAddress("KEEPER");
        bool allowed = vm.envOr("ALLOWED", true);
        require(keeper != address(0), "KEEPER is the zero address");

        address[3] memory guards = [G_STEADY, G_BALANCED, G_GROWTH];

        vm.startBroadcast();
        for (uint256 i; i < guards.length; ++i) {
            KeeperGuard(guards[i]).setKeeper(keeper, allowed);
        }
        vm.stopBroadcast();

        /* Read back rather than trust the send. Three `true` is the only
           result that means the job is done. */
        for (uint256 i; i < guards.length; ++i) {
            console2.log(guards[i], KeeperGuard(guards[i]).isKeeper(keeper));
        }
    }
}
