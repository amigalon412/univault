/**
 * Who can do what to a BLUR vault.
 *
 * Read off contracts/src/BlurVault.sol and contracts/src/KeeperGuard.sol, not
 * off the site's own copy -- the existing prose hedges ("designed so a
 * compromised keeper can't touch your principal") and a hedge must not become
 * an unhedged dot in a table.
 *
 * Each row carries the function it is about, so any row can be re-checked
 * without re-reading both contracts. A row that cannot name a function or a
 * specific absence does not belong here and should be deleted rather than
 * softened.
 */

export type Actor = "you" | "keeper" | "owner" | "anyone";

export interface PermissionRow {
  action: string;
  can: Actor[];
  /** Where this was read from. Not rendered; it is here to be checkable. */
  source: string;
}

export const ACTORS: { key: Actor; label: string }[] = [
  { key: "you", label: "YOU" },
  { key: "keeper", label: "KEEPER" },
  { key: "owner", label: "OWNER" },
  { key: "anyone", label: "ANYONE" },
];

export const PERMISSIONS: PermissionRow[] = [
  {
    action: "DEPOSIT",
    can: ["you", "owner", "anyone"],
    source: "BlurVault.deposit / mint — public, no gate",
  },
  {
    action: "REDEEM YOUR SHARES",
    can: ["you"],
    source: "BlurVault.withdraw / redeem — ERC-4626 allowance only",
  },
  {
    action: "REDEEM WHEN PRICES ARE STALE",
    can: ["you"],
    source:
      "BlurVault.redeemInKind — share-ledger arithmetic, consults no price, skips the fee when unpriceable",
  },
  {
    action: "MOVE THE ASSETS ANYWHERE ELSE",
    can: [],
    source:
      "No such function. grep for rescue|pause|transfer(owner in BlurVault.sol returns nothing; recallAll is onlyOwner but pulls from the venue back into the vault",
  },
  {
    action: "BLOCK YOUR EXIT",
    can: [],
    source:
      "No such function. The vault is not Pausable; KeeperGuard.pause halts automation, not withdrawals",
  },
  {
    action: "SWAP THE BASKET FOR ANOTHER",
    can: [],
    source:
      "BlurVault.setBasket — onlyOwner, but reverts BasketAlreadySet once set and VaultInUse once any share exists",
  },
  {
    action: "REBALANCE TO TARGET",
    can: ["keeper", "owner"],
    source: "BlurVault._requireAutomation — msg.sender must be owner() or guard",
  },
  {
    action: "HALT AUTOMATION",
    can: ["owner"],
    source: "KeeperGuard.pause — owner or an allowlisted sentinel",
  },
  {
    action: "CHANGE THE TARGET SPLIT",
    can: ["owner"],
    source: "BlurVault.setTargetStableBps — onlyOwner, capped at BPS",
  },
  {
    action: "CHANGE THE FEE",
    can: ["owner"],
    source:
      "BlurVault.setPerformanceFeeBps — onlyOwner, reverts FeeTooHigh above 2_000 bps, and settles the old rate first",
  },
];

/**
 * The line under the table. Written after the rows, and stating what the rows
 * actually prove rather than what would be nicest to claim: the owner can
 * retune the vault, and that is exactly what makes the empty cells mean
 * something.
 */
export const PERMISSION_CAPTION = {
  lead: "An owner can retune this vault. They cannot reach into it.",
  body:
    "Every dot is a function with a modifier on it. The empty cells are not guarded functions — they are functions that were never written, which is why the fee, the split and the automation switch are listed here alongside them.",
};
