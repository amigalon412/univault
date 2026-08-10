/**
 * Who can move a UNIVAULT vault's assets.
 *
 * Read off contracts/src/BlurVault.sol and contracts/src/KeeperGuard.sol, not
 * off the site's own copy -- the existing prose hedges ("designed so a
 * compromised keeper can't touch your principal") and a hedge must not become
 * an unhedged dot in a table.
 *
 * Scoped to custody on purpose. An owner does have tuning powers -- the fee,
 * the target split and the automation switch are all onlyOwner and all exist
 * -- and an unscoped table that omitted them would be false by omission, since
 * the caption below says an empty cell means no such function. Narrowing the
 * question to "what can happen to the money" is what makes their absence
 * principled rather than convenient: none of the three moves an asset.
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
    can: ["you", "keeper", "owner", "anyone"],
    source: "Univault.deposit / mint — public, no gate",
  },
  {
    action: "REDEEM YOUR SHARES",
    can: ["you"],
    source: "Univault.withdraw / redeem — ERC-4626 allowance only",
  },
  {
    action: "REDEEM WHEN PRICES ARE STALE",
    can: ["you"],
    source:
      "Univault.redeemInKind — share-ledger arithmetic, consults no price, skips the fee when unpriceable",
  },
  {
    action: "MOVE THE ASSETS ANYWHERE ELSE",
    can: [],
    source:
      "No such function. grep for rescue|pause|transfer(owner in the vault source returns nothing; recallAll is onlyOwner but pulls from the venue back into the vault",
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
      "Univault.setBasket — onlyOwner, but reverts BasketAlreadySet once set and VaultInUse once any share exists",
  },
  {
    action: "REBALANCE TO TARGET",
    can: ["keeper", "owner"],
    source: "Univault._requireAutomation — msg.sender must be owner() or guard",
  },
];

/**
 * The line under the table. Written after the rows, and stating what the rows
 * actually prove rather than what would be nicest to claim: the owner can
 * retune the vault, and that is exactly what makes the empty cells mean
 * something.
 */
export const PERMISSION_CAPTION = {
  lead: "Nobody can take your position off you.",
  body:
    "Every dot is a function with a modifier on it. Every dash is a function that does not exist — not one that is guarded, one that was never written. There is no pause on this vault, no rescue path, and no address an admin can send the assets to.",
};
