// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title BLUR
/// @notice The protocol token. One billion, minted once, and that is the whole
///         of it.
///
/// @dev What this contract does not have is the point of it. There is no owner,
///      so there is nothing to renounce and nothing to steal. There is no mint
///      beyond the constructor, so the supply printed at deployment is the
///      supply forever. There is no pause, no blocklist, no fee-on-transfer, no
///      proxy and no upgrade path. Nobody -- including whoever deploys it --
///      can freeze a balance, seize one, dilute a holder, or change how a
///      transfer behaves after the fact.
///
///      It can only go down. `burn` is the one supply-changing function and it
///      takes from the caller's own balance, which is what lets BuybackModule
///      retire what it buys by actually reducing `totalSupply` rather than
///      parking tokens at a dead address and calling that a burn.
contract UnivaultToken is ERC20, ERC20Burnable {
    /// @notice The entire supply. Minted at construction, never added to.
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    constructor(address recipient) ERC20("UNIVAULT", "UNIVAULT") {
        _mint(recipient, TOTAL_SUPPLY);
    }
}
