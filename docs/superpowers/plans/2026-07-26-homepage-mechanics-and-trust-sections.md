# Homepage mechanics and trust sections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage section that duplicates the vault preview with two sections the page does not otherwise have a shape for — a traced deposit flow linking every node to its deployed contract, and a permission matrix read off the Solidity.

**Architecture:** Two client components, each rendering from a data module in `src/lib/`. Data is separated from layout so a claim that turns out to be false is a one-line deletion, not a re-layout. Both reuse the existing panel chrome, the existing pixel-cell renderer and the existing explorer-URL helper. No chain reads, no network calls, no new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4. Existing: `PixelLogo` + `pixelLevels` (cell rendering), `explorerAddressUrl` (Blockscout links), `.figure-in` (reveal animation), `AnimationGovernor` (pauses infinite animations off-screen).

**On testing:** this repo has no test runner and no test directory. Verification is `npm run check` (lint + typecheck + build) plus manual browser checks — that is the established pattern here and this plan follows it rather than introducing vitest as a side effect. Two things still get real red-green cycles: TypeScript itself (define the type, watch the data fail to compile, fix it), and `scripts/check-addresses.mjs`, a Node assertion added in Task 3 that fails loudly if any address in the new code disagrees with `contracts/DEPLOYMENTS.md`. That is the highest-risk failure mode in this work — a wrong address printed under a link labelled "verified" — and it is the one thing worth automating.

---

## What reading the contracts changed

The spec put a verification gate on the permission matrix: no cell written from memory. That gate has now been run against `contracts/src/BlurVault.sol` and `contracts/src/KeeperGuard.sol`, and it changed the table.

**Confirmed absent** (grep for `rescue|pause|Pausable|transfer(owner` in `BlurVault.sol` returns nothing):

- No `pause` on the vault. Nothing can stop a withdrawal.
- No rescue or sweep-to-owner function. No path moves assets to an arbitrary address.
- `redeemInKind` (line 334) has no owner gate and explicitly works when the vault cannot be priced.

**Confirmed present, and now shown** — these are real owner powers that the first draft of the table did not admit:

- `setTargetStableBps` (line 660) — the owner can change the split.
- `setPerformanceFeeBps` (line 280) — the owner can change the fee, hard-capped at `2_000` bps.
- `KeeperGuard.pause()` (line 178) — owner or sentinel can halt **automation**. Not exits.
- `_requireAutomation` (line 601) — rebalance is callable by `owner()` **or** `guard`, so the keeper column is not alone.
- `recallAll` (line 619) — `onlyOwner`, but it pulls from the lending venue back into the vault. Its own comment: *"Moves assets toward depositors, never away from them."*
- `setBasket` (line 648) — once only, and reverts once any share exists.

Admitting the three owner powers is what makes the empty cells credible. A table where the owner column is blank reads as marketing; a table where the owner can retune the vault but still cannot reach the assets reads as a fact.

---

## File structure

| File | Responsibility |
|---|---|
| `src/components/Bracket.tsx` | **New.** Corner bracket, extracted from `VaultPreview` — three panels need it |
| `src/components/ContractLink.tsx` | **New.** One address chip: truncate, link to Blockscout, render nothing when null |
| `src/lib/pixel-glyphs.ts` | **New.** Seven 16×16 pictograms in the `pixel-logos` format |
| `src/lib/mechanics.ts` | **New.** Flow nodes and trace steps as data |
| `src/lib/permissions.ts` | **New.** Matrix rows as data, each carrying its source note |
| `src/components/MechanicsSection.tsx` | **New.** Section A: diagram, rail, numbered trace |
| `src/components/TrustSection.tsx` | **New.** Section B: matrix, caption, code band, footer |
| `scripts/check-addresses.mjs` | **New.** Asserts every address in `chain.ts` appears in `DEPLOYMENTS.md` |
| `src/lib/chain.ts` | **Modify.** Export `BASKET_ADAPTER`, `PRICE_ORACLE`, `KEEPER_GUARD` |
| `src/components/PixelLogo.tsx` | **Modify.** Optional `grid` prop so 16×16 glyphs render at the right scale |
| `src/components/VaultPreview.tsx` | **Modify.** Import `Bracket`; take `id="vaults"` |
| `src/app/page.tsx` | **Modify.** Swap the sections |
| `src/components/CommandsSection.tsx` | **Delete.** Duplicated by `VaultPreview` |
| `src/components/GuideSection.tsx` | **Delete.** Absorbed by `MechanicsSection` |
| `src/components/SecuritySection.tsx` | **Delete.** Absorbed by `TrustSection` |

---

## Task 1: Extract the corner bracket

`Bracket` is currently private to `VaultPreview`. Three panels need it.

**Files:**
- Create: `src/components/Bracket.tsx`
- Modify: `src/components/VaultPreview.tsx` (lines 18–30, and the four usages)

- [ ] **Step 1: Create the component**

`src/components/Bracket.tsx`:

```tsx
/**
 * L-shaped bracket at one corner of a panel. The same device the launch films
 * use, and the thing that makes the three panels on the homepage read as a set
 * rather than as three unrelated boxes.
 *
 * The parent must be `position: relative`.
 */
export function Bracket({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const v = at[0] === "t" ? "top-[-1px]" : "bottom-[-1px]";
  const h = at[1] === "l" ? "left-[-1px]" : "right-[-1px]";
  const bv = at[0] === "t" ? "border-t-2" : "border-b-2";
  const bh = at[1] === "l" ? "border-l-2" : "border-r-2";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${v} ${h} ${bv} ${bh} z-20 h-4 w-4 border-wire-cyan`}
    />
  );
}
```

- [ ] **Step 2: Delete the private copy from VaultPreview**

In `src/components/VaultPreview.tsx`, delete this whole block:

```tsx
/** L-bracket at one corner of the panel. Same device as the films use. */
function Bracket({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
  const v = at[0] === "t" ? "top-[-1px]" : "bottom-[-1px]";
  const h = at[1] === "l" ? "left-[-1px]" : "right-[-1px]";
  const bv = at[0] === "t" ? "border-t-2" : "border-b-2";
  const bh = at[1] === "l" ? "border-l-2" : "border-r-2";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${v} ${h} ${bv} ${bh} z-20 h-4 w-4 border-wire-cyan`}
    />
  );
}
```

- [ ] **Step 3: Import it instead**

In `src/components/VaultPreview.tsx`, add to the imports at the top:

```tsx
import { Bracket } from "@/components/Bracket";
```

- [ ] **Step 4: Verify nothing else changed**

Run: `npm run typecheck`
Expected: no output beyond the `> tsc --noEmit` banner. The four `<Bracket at="…" />` usages in `VaultPreview` are unchanged and now resolve to the import.

- [ ] **Step 5: Commit**

```bash
git add src/components/Bracket.tsx src/components/VaultPreview.tsx
git commit -m "refactor: extract Bracket so three panels can share it"
```

---

## Task 2: Let PixelLogo render a non-26 grid

`PixelLogo` hardcodes its viewBox to `PIXEL_GRID` (26), the size the company marks were sampled at. The new pictograms are hand-authored at 16.

**Files:**
- Modify: `src/components/PixelLogo.tsx`

- [ ] **Step 1: Add the prop and use it**

Replace the whole of `src/components/PixelLogo.tsx` with:

```tsx
import { pixelLevels } from "@/lib/pixel-grid";
import { PIXEL_GRID, type PixelLogo as PixelLogoData } from "@/lib/pixel-logos";

interface PixelLogoProps {
  logo: PixelLogoData;
  /** Rendered size in px. The grid is square, so this is both dimensions. */
  size?: number;
  /**
   * Cells per side. Defaults to the 26 the company marks were sampled at; the
   * hand-authored pictograms in pixel-glyphs.ts are 16 and would render at the
   * wrong scale without this.
   */
  grid?: number;
  className?: string;
}

/**
 * A mark drawn as an LED matrix in the site's own green.
 *
 * The alternative was dropping the four brand PNGs onto the page, which puts
 * NVIDIA green, Amazon orange and Tesla red on a black monospace layout and
 * makes the section look like a partner logo strip. Rendering coverage instead
 * of colour keeps the marks recognisable while letting them belong here.
 *
 * Cells are grouped by ink level into one path each, so a mark that lights 370
 * cells ships as nine paths. Static SVG: it costs nothing after paint.
 */
export function PixelLogo({
  logo,
  size = 96,
  grid = PIXEL_GRID,
  className = "",
}: PixelLogoProps) {
  const levels = pixelLevels(logo.rows);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      role="img"
      aria-label={`${logo.name} (${logo.key})`}
      className={className}
      shapeRendering="crispEdges"
    >
      {levels.map((l) => (
        <path
          key={l.level}
          d={l.d}
          fill="currentColor"
          opacity={0.35 + (l.level / 9) * 0.65}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Verify the existing callers still compile**

Run: `npm run typecheck`
Expected: clean. `grid` is optional, so the three existing `<PixelLogo>` usages in `VaultPreview.tsx` are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/components/PixelLogo.tsx
git commit -m "feat: let PixelLogo render grids other than 26"
```

---

## Task 3: Export the missing contract addresses, guarded by a check

Three addresses the diagram links to live only in `contracts/DEPLOYMENTS.md`. They belong in `chain.ts` with the others, not inlined in a component. The check script is written **first** and must fail before the constants exist.

**Files:**
- Create: `scripts/check-addresses.mjs`
- Modify: `src/lib/chain.ts`

- [ ] **Step 1: Write the failing check**

`scripts/check-addresses.mjs`:

```js
/* Asserts that every hard-coded contract address in src/lib/chain.ts also
   appears in contracts/DEPLOYMENTS.md.

   This exists because of a specific near-miss: a launch video shipped three
   vault addresses taken from the "Superseded — do not use" section of that
   file, displayed under a green VERIFIED tick. Addresses that are wrong but
   look authoritative are the worst failure this codebase can ship, and they
   are invisible to typecheck, lint and eyeballs alike.

   Run: node scripts/check-addresses.mjs */

import { readFileSync } from "node:fs";

const chain = readFileSync("src/lib/chain.ts", "utf8");
const deployments = readFileSync("contracts/DEPLOYMENTS.md", "utf8").toLowerCase();

/* Only the named constants — not every 0x string in the file. Multicall3 is a
   canonical cross-chain address and is deliberately not in DEPLOYMENTS.md. */
const CHECKED = [
  "USDG",
  "STEAK_USDG",
  "BASKET_ADAPTER",
  "PRICE_ORACLE",
  "KEEPER_GUARD",
  "EXIT_ROUTER_FALLBACK",
];

const failures = [];

for (const name of CHECKED) {
  const re = new RegExp(`${name}[^=]*=\\s*(?:getAddress\\()?\\s*"(0x[0-9a-fA-F]{40})"`);
  const m = chain.match(re);
  if (!m) {
    failures.push(`${name}: not found in src/lib/chain.ts`);
    continue;
  }
  if (!deployments.includes(m[1].toLowerCase())) {
    failures.push(`${name}: ${m[1]} is not in contracts/DEPLOYMENTS.md`);
  }
}

/* The superseded vaults must never appear in shipped code. */
const SUPERSEDED = [
  "0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996",
  "0x066d4661A5419A68b64a0dCF51f5c295185dB175",
  "0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787",
];
for (const dead of SUPERSEDED) {
  if (chain.toLowerCase().includes(dead.toLowerCase())) {
    failures.push(`superseded vault ${dead} is referenced in chain.ts`);
  }
}

if (failures.length) {
  console.error("address check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`address check passed (${CHECKED.length} constants)`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-addresses.mjs`

Expected: exit code 1, and output naming the four constants that do not exist yet:

```
address check FAILED:
  - BASKET_ADAPTER: not found in src/lib/chain.ts
  - PRICE_ORACLE: not found in src/lib/chain.ts
  - KEEPER_GUARD: not found in src/lib/chain.ts
  - EXIT_ROUTER_FALLBACK: not found in src/lib/chain.ts
```

- [ ] **Step 3: Add the constants**

In `src/lib/chain.ts`, immediately after the `STEAK_USDG` export, add:

```ts
/**
 * The rest of the BALANCED vault's machinery, addressed here rather than in a
 * component because that is where every other address on this chain lives.
 *
 * BALANCED is the strategy the homepage diagram traces: it is the only one of
 * the three that exercises both legs, so it is the only one that shows the
 * whole machine. GROWTH has its own adapter, oracle and guard; STEADY has no
 * basket at all. See contracts/DEPLOYMENTS.md.
 */
export const BASKET_ADAPTER: Address = getAddress(
  "0x8449202B6525F9632eB25809B91B50c1820fAAE4",
);
export const PRICE_ORACLE: Address = getAddress(
  "0x932aa45036045540dbfab7252bd3398f35f32e76",
);
export const KEEPER_GUARD: Address = getAddress(
  "0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613",
);

/**
 * The deployed ExitRouter, for display only.
 *
 * `EXIT_ROUTER` below reads the environment and is null until it is set, which
 * is right for the app -- it must not offer a button backed by nothing. The
 * homepage is describing what exists on chain, not offering to call it, so it
 * uses this constant and always has something to link to.
 */
export const EXIT_ROUTER_FALLBACK: Address = getAddress(
  "0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0",
);
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node scripts/check-addresses.mjs`
Expected: `address check passed (6 constants)`, exit code 0.

- [ ] **Step 5: Wire it into the repo's check command**

In `package.json`, change the `check` script:

```json
"check": "node scripts/check-addresses.mjs && npm run lint && npm run typecheck && npm run build"
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-addresses.mjs src/lib/chain.ts package.json
git commit -m "feat: export basket, oracle and guard addresses with a consistency check

A launch asset once shipped three vault addresses copied out of the
\"Superseded -- do not use\" table under a green VERIFIED tick. Typecheck,
lint and eyeballs are all blind to that class of mistake, so it gets a
script that reads DEPLOYMENTS.md and refuses to agree."
```

---

## Task 4: The seven pictograms

**Files:**
- Create: `src/lib/pixel-glyphs.ts`

- [ ] **Step 1: Write the file**

`src/lib/pixel-glyphs.ts`:

```ts
import type { PixelLogo } from "@/lib/pixel-logos";

/**
 * Pictograms for the mechanics diagram, hand-authored as ink matrices in the
 * same format as pixel-logos.ts so the existing PixelLogo renderer draws them.
 *
 * Hand-authored rather than sampled, because unlike the company marks these
 * have no original to sample from. 16x16 rather than 26x26: at the size they
 * appear in a diagram node, 26 cells of detail is detail nobody can see, and
 * the coarser grid reads more clearly as cells.
 */
export const GLYPH_GRID = 16;

const glyph = (key: string, name: string, rows: string[]): PixelLogo => ({
  key,
  name,
  rows,
});

/** What you deposit. A coin, seen face on, with a stem through it. */
export const COIN = glyph("USDG", "Stablecoin", [
  "0000011111100000",
  "0000111111110000",
  "0011110000111100",
  "0111000000001110",
  "0110000990000110",
  "1100000990000011",
  "1100000990000011",
  "1100000990000011",
  "1100000990000011",
  "1100000990000011",
  "1100000990000011",
  "0110000990000110",
  "0111000000001110",
  "0011110000111100",
  "0000111111110000",
  "0000011111100000",
]);

/** The vault itself. A safe door with a dial and feet. */
export const VAULT = glyph("VAULT", "Vault", [
  "1111111111111111",
  "1000000000000001",
  "1011111111111101",
  "1010000000000101",
  "1010011111100101",
  "1010110000110101",
  "1010110990110101",
  "1010110990110101",
  "1010110000110101",
  "1010011111100101",
  "1010000000000101",
  "1011111111111101",
  "1000000000000001",
  "1111111111111111",
  "0011000000001100",
  "0011000000001100",
]);

/** The lending leg. Interest, drawn as a rising bar chart. */
export const YIELD = glyph("YIELD", "Lending yield", [
  "0000000000000000",
  "0000000000001110",
  "0000000000001110",
  "0000000000001110",
  "0000000111001110",
  "0000000111001110",
  "0000000111001110",
  "0001110111001110",
  "0001110111001110",
  "0001110111001110",
  "1110111011101110",
  "1110111011101110",
  "1110111011101110",
  "1110111011101110",
  "1110111011101110",
  "0000000000000000",
]);

/** The equity leg. A basket, woven. */
export const BASKET = glyph("BASKET", "Stock basket", [
  "0000000000000000",
  "0011000000001100",
  "0001100000011000",
  "0000110000110000",
  "1111111111111111",
  "1111111111111111",
  "1100110011001100",
  "1100110011001100",
  "1100110011001100",
  "1100110011001100",
  "0110011001100110",
  "0110011001100110",
  "0011001100110011",
  "0011111111111100",
  "0001111111111000",
  "0000000000000000",
]);

/** The price feed. A crosshair, sighting on a value. */
export const ORACLE = glyph("ORACLE", "Price oracle", [
  "0000000110000000",
  "0000000110000000",
  "0000111111110000",
  "0011111111111100",
  "0111100110011110",
  "0111000000001110",
  "1110000000000111",
  "1100000990000011",
  "1100000990000011",
  "1110000000000111",
  "0111000000001110",
  "0111100110011110",
  "0011111111111100",
  "0000111111110000",
  "0000000110000000",
  "0000000110000000",
]);

/** The keeper's limits. A shield. */
export const GUARD = glyph("GUARD", "Keeper guard", [
  "0000011111100000",
  "0001111111111000",
  "0011111111111100",
  "0111111111111110",
  "1111111111111111",
  "1111111111111111",
  "1111111111111111",
  "1111111111111111",
  "0111111111111110",
  "0111111111111110",
  "0011111111111100",
  "0001111111111000",
  "0000111111110000",
  "0000011111100000",
  "0000001111000000",
  "0000000110000000",
]);

/** The way out. A door, standing open-able. */
export const EXIT = glyph("EXIT", "Exit router", [
  "1111111111111100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000990000100",
  "1100000990000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1100000000000100",
  "1111111111111100",
  "0000000000000000",
]);
```

- [ ] **Step 2: Verify every matrix is square**

Run:

```bash
node --input-type=module -e "
import * as G from './src/lib/pixel-glyphs.ts';
let bad = 0;
for (const [k, v] of Object.entries(G)) {
  if (!v || !v.rows) continue;
  if (v.rows.length !== 16 || v.rows.some(r => r.length !== 16)) {
    console.error('NOT 16x16:', k, v.rows.length, v.rows.map(r => r.length).join(','));
    bad++;
  }
}
console.log(bad ? 'FAILED' : 'all glyphs are 16x16');
"
```

Expected: `all glyphs are 16x16`

If Node cannot import the `.ts` directly in this environment, run `npm run typecheck` instead and check the row lengths by eye — each array above is 16 strings of 16 characters.

- [ ] **Step 3: Commit**

```bash
git add src/lib/pixel-glyphs.ts
git commit -m "feat: seven hand-authored pictograms for the mechanics diagram"
```

---

## Task 5: The mechanics data

**Files:**
- Create: `src/lib/mechanics.ts`

- [ ] **Step 1: Write the file**

`src/lib/mechanics.ts`:

```ts
import type { Address } from "viem";
import {
  BASKET_ADAPTER,
  EXIT_ROUTER_FALLBACK,
  KEEPER_GUARD,
  PRICE_ORACLE,
  STEAK_USDG,
  USDG,
  VAULT_ADDRESSES,
} from "@/lib/chain";
import { BASKET, COIN, EXIT, GUARD, ORACLE, VAULT, YIELD } from "@/lib/pixel-glyphs";
import type { PixelLogo } from "@/lib/pixel-logos";

/**
 * The BALANCED deposit path, as data.
 *
 * Kept out of the component so that a wrong address or a wrong sentence is a
 * one-line edit and not a re-layout, and so scripts/check-addresses.mjs has a
 * single place to look.
 *
 * BALANCED and not one of the others: STEADY has no equity leg and GROWTH is
 * the same machine at a different ratio, so BALANCED is the only one of the
 * three that shows every part.
 */

export interface FlowNode {
  glyph: PixelLogo;
  name: string;
  /** One line, upper case on screen. What this part is for. */
  role: string;
  /** Null renders the node without a link rather than with a dead one. */
  address: Address | null;
}

export interface TraceStep {
  num: string;
  title: string;
  body: string;
  links: { label: string; address: Address | null }[];
}

/** Where the money enters. */
export const SOURCE_NODE: FlowNode = {
  glyph: COIN,
  name: "USDG",
  role: "WHAT YOU SEND",
  address: USDG,
};

/** The hub everything passes through. */
export const VAULT_NODE: FlowNode = {
  glyph: VAULT,
  name: "BLUR VAULT",
  role: "MINTS YOUR SHARES",
  address: VAULT_ADDRESSES.balanced,
};

/** The two legs it splits into, with the target split for BALANCED. */
export const LEG_NODES: (FlowNode & { pct: string })[] = [
  {
    glyph: YIELD,
    name: "LENDING LEG",
    role: "STEAKHOUSE USDG",
    address: STEAK_USDG,
    pct: "60%",
  },
  {
    glyph: BASKET,
    name: "STOCK BASKET",
    role: "NVDA · AAPL · TSLA · AMZN",
    address: BASKET_ADAPTER,
    pct: "40%",
  },
];

/** Machinery that keeps it on target. Listed, not wired into the path. */
export const RAIL_NODES: FlowNode[] = [
  { glyph: ORACLE, name: "ORACLE", role: "PRICES THE BASKET", address: PRICE_ORACLE },
  { glyph: GUARD, name: "KEEPER GUARD", role: "CAPS THE KEEPER", address: KEEPER_GUARD },
  { glyph: EXIT, name: "EXIT ROUTER", role: "SELLS A POSITION OUT", address: EXIT_ROUTER_FALLBACK },
];

/**
 * The same path in words. Each sentence is written against the contract, not
 * against the marketing copy: step 3 says "in the same transaction" because
 * BlurVault._allocateOnDeposit runs inside deposit(), and step 4 says the
 * keeper is capped because KeeperGuard holds per-call size and slippage caps.
 */
export const TRACE_STEPS: TraceStep[] = [
  {
    num: "01",
    title: "YOU SEND USDG",
    body: "An ordinary ERC-20 transfer. Six decimals, not eighteen.",
    links: [{ label: "USDG", address: USDG }],
  },
  {
    num: "02",
    title: "THE VAULT MINTS SHARES TO YOUR ADDRESS",
    body:
      "Standard ERC-4626. The shares are yours, and no function on the vault moves the assets behind them anywhere but back to a holder.",
    links: [{ label: "VAULT", address: VAULT_ADDRESSES.balanced }],
  },
  {
    num: "03",
    title: "IT SPLITS ITSELF IN THE SAME TRANSACTION",
    body:
      "60% is supplied to the lending venue, 40% buys the four stock tokens at 25% each. Nobody has to come along later and do it.",
    links: [
      { label: "LENDING", address: STEAK_USDG },
      { label: "BASKET", address: BASKET_ADAPTER },
    ],
  },
  {
    num: "04",
    title: "A KEEPER PULLS IT BACK ON TARGET",
    body:
      "When the split drifts, automation trades it back. Per-call size and slippage caps live on the guard, so what it may move is bounded on chain.",
    links: [
      { label: "GUARD", address: KEEPER_GUARD },
      { label: "ORACLE", address: PRICE_ORACLE },
    ],
  },
];
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: clean. If `VAULT_ADDRESSES.balanced` errors on its type, it is `Address | null` by design — `FlowNode.address` already allows null.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mechanics.ts
git commit -m "feat: the BALANCED deposit path as data"
```

---

## Task 6: ContractLink

**Files:**
- Create: `src/components/ContractLink.tsx`

- [ ] **Step 1: Write the component**

`src/components/ContractLink.tsx`:

```tsx
import type { Address } from "viem";
import { explorerAddressUrl } from "@/lib/chain";

interface ContractLinkProps {
  address: Address | null;
  /** Shown before the address, e.g. "VAULT". Omit for a bare chip. */
  label?: string;
  /** `chip` is bordered, for diagram nodes. `bare` is inline, for lists. */
  variant?: "chip" | "bare";
  className?: string;
}

/**
 * A truncated contract address that opens on Blockscout.
 *
 * Renders nothing at all when the address is null. That is the normal state
 * before a deployment -- VAULT_ADDRESSES reads the environment -- and a link
 * to nowhere under a heading about verifiable contracts is worse than no link.
 */
export function ContractLink({
  address,
  label,
  variant = "chip",
  className = "",
}: ContractLinkProps) {
  if (!address) return null;

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const base =
    variant === "chip"
      ? "inline-block border border-wire-cyan/25 px-2 py-0.5 text-[10px] text-wire-muted hover:text-wire-cyan hover:border-wire-cyan transition-colors"
      : "text-[10px] text-wire-muted hover:text-wire-cyan border-b border-dotted border-wire-cyan/30 transition-colors";

  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className={`${base} ${className}`}
    >
      {label ? `${label} ` : ""}
      {short} ↗
    </a>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ContractLink.tsx
git commit -m "feat: contract address chip that disappears when unset"
```

---

## Task 7: MechanicsSection

**Files:**
- Create: `src/components/MechanicsSection.tsx`
- Modify: `src/app/globals.css` (append)

- [ ] **Step 1: Add the travelling-dot animation**

Append to `src/app/globals.css`:

```css
/* A dot running along a connector in the mechanics diagram. Infinite, so
   AnimationGovernor pauses it off-screen and in background tabs -- the same
   treatment every other endless animation on this page gets. */
.flow-dot {
  animation: flowDot 2.6s linear infinite;
}
@keyframes flowDot {
  from { left: -4px; }
  to { left: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .flow-dot {
    animation: none;
    left: 50%;
  }
}
```

- [ ] **Step 2: Write the component**

`src/components/MechanicsSection.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
import { ContractLink } from "@/components/ContractLink";
import { PixelLogo } from "@/components/PixelLogo";
import { GLYPH_GRID } from "@/lib/pixel-glyphs";
import {
  LEG_NODES,
  RAIL_NODES,
  SOURCE_NODE,
  TRACE_STEPS,
  VAULT_NODE,
  type FlowNode,
} from "@/lib/mechanics";

/** One box in the diagram. */
function Node({ node, hub = false }: { node: FlowNode; hub?: boolean }) {
  return (
    <div
      className={
        "bg-black px-4 py-3.5 text-center " +
        (hub
          ? "border border-wire-cyan shadow-[0_0_24px_rgba(214,254,81,0.14)]"
          : "border border-wire-cyan/35")
      }
    >
      <PixelLogo
        logo={node.glyph}
        grid={GLYPH_GRID}
        size={26}
        className="text-wire-cyan mx-auto"
      />
      <div className="font-mono text-[10px] text-wire-cyan tracking-[0.18em] mt-2.5">
        {node.name}
      </div>
      <div className="font-mono text-[9px] text-wire-muted/70 tracking-[0.1em] mt-1">
        {node.role}
      </div>
      <div className="mt-2.5">
        <ContractLink address={node.address} />
      </div>
    </div>
  );
}

/** A dashed connector with a dot running along it. */
function Connector({ delay = 0, pct }: { delay?: number; pct?: string }) {
  return (
    <div className="relative mx-3 min-w-8 flex-1">
      <div className="h-px bg-[repeating-linear-gradient(90deg,rgba(214,254,81,0.5)_0_4px,transparent_4px_10px)]" />
      <span
        aria-hidden
        className="flow-dot absolute -top-[2px] h-[5px] w-[5px] rounded-full bg-wire-cyan shadow-[0_0_8px_#d6fe51]"
        style={{ animationDelay: `${delay}ms` }}
      />
      {pct && (
        <span className="absolute -top-2 right-3 bg-black px-1 font-mono text-[10px] text-wire-cyan tracking-[0.1em]">
          {pct}
        </span>
      )}
    </div>
  );
}

/**
 * How one deposit moves, traced through the contracts it actually touches.
 *
 * Replaces a section that repeated the vault preview's three strategy cards.
 * The page had no diagram and no external evidence in it anywhere; this is
 * both. Every node links to a deployed, verified contract, so the claim is
 * checkable rather than asserted.
 */
export function MechanicsSection() {
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Below the fold, so the reveal is triggered by arrival rather than by mount.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="mechanics"
      className="border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto" ref={root}>
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// HOW ONE DEPOSIT MOVES"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-3 leading-snug">
          Follow the money. Every box is a contract.
        </h2>
        <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-2xl mb-8">
          Not a diagram of an intention. Each node opens the deployed, verified
          contract on the explorer — read what it does rather than taking this
          page&apos;s word for it.
        </p>

        <div className="relative border border-wire-cyan/25 bg-wire-card">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          <div className="flex items-center gap-3 border-b border-wire-cyan/20 px-4 sm:px-6 py-2.5 font-mono text-[10px] tracking-[0.26em] text-wire-muted">
            <span className="text-wire-cyan glow-cyan whitespace-nowrap">
              ▸ BALANCED · 60 / 40
            </span>
            <span className="hidden md:inline text-wire-muted/70">ERC-4626</span>
            <span className="ml-auto flex items-center gap-2 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-wire-cyan animate-earn" />
              LIVE ON ROBINHOOD CHAIN
            </span>
          </div>

          <div
            className="relative p-5 sm:p-8"
            style={{
              backgroundImage:
                "linear-gradient(rgba(214,254,81,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(214,254,81,0.05) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          >
            {/* Stacks under md: a horizontal flow has nowhere to go on a phone. */}
            <div
              className={
                "flex flex-col md:flex-row md:items-center gap-4 md:gap-0 " +
                (seen ? "figure-in" : "opacity-0")
              }
            >
              <Node node={SOURCE_NODE} />
              <div className="hidden md:block flex-1">
                <Connector />
              </div>
              <Node node={VAULT_NODE} hub />
              <div className="hidden md:block relative flex-1">
                <div className="mb-11">
                  <Connector delay={500} pct={LEG_NODES[0].pct} />
                </div>
                <Connector delay={1100} pct={LEG_NODES[1].pct} />
              </div>
              <div className="flex flex-col gap-4 md:min-w-[190px]">
                {LEG_NODES.map((leg) => (
                  <Node key={leg.name} node={leg} />
                ))}
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-wire-cyan/15 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[9px] text-wire-muted/70 tracking-[0.26em]">
                KEPT ON TARGET BY
              </span>
              {RAIL_NODES.map((n) => (
                <span
                  key={n.name}
                  className="flex items-center gap-2 border border-wire-cyan/20 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] text-wire-muted"
                >
                  <PixelLogo
                    logo={n.glyph}
                    grid={GLYPH_GRID}
                    size={13}
                    className="text-wire-cyan shrink-0"
                  />
                  <span className="text-wire-cyan">{n.name}</span>
                  <ContractLink address={n.address} variant="bare" />
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-wire-cyan/20">
            {TRACE_STEPS.map((s, i) => (
              <div
                key={s.num}
                className={
                  "grid grid-cols-[34px_1fr] md:grid-cols-[34px_1fr_auto] gap-x-4 gap-y-2 px-5 sm:px-8 py-4 border-b border-wire-cyan/8 last:border-b-0 " +
                  (seen ? "figure-in" : "opacity-0")
                }
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                <div className="font-mono text-[10px] text-wire-cyan/45 pt-0.5">
                  {s.num}
                </div>
                <div>
                  <div className="font-mono text-[11px] text-wire-cyan tracking-[0.16em]">
                    {s.title}
                  </div>
                  <div className="font-mono text-xs text-wire-muted leading-relaxed mt-1.5">
                    {s.body}
                  </div>
                </div>
                <div className="col-start-2 md:col-start-3 flex flex-wrap md:flex-col md:items-end gap-x-3 gap-y-1">
                  {s.links.map((l) => (
                    <ContractLink
                      key={l.label}
                      address={l.address}
                      label={l.label}
                      variant="bare"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `npm run typecheck && npm run lint`
Expected: typecheck clean; lint reports no **errors** (the repo carries 15 pre-existing warnings — the count must not grow).

- [ ] **Step 4: Commit**

```bash
git add src/components/MechanicsSection.tsx src/app/globals.css
git commit -m "feat: mechanics section — one deposit traced through its contracts"
```

---

## Task 8: The permission data

Every row below was read off `contracts/src/BlurVault.sol` and
`contracts/src/KeeperGuard.sol`. The `source` field records where, so a future
reader can re-check a row without re-reading both files.

**Files:**
- Create: `src/lib/permissions.ts`

- [ ] **Step 1: Write the file**

`src/lib/permissions.ts`:

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: permission matrix, read off BlurVault.sol and KeeperGuard.sol

Three owner powers the first draft omitted are now in the table -- the fee,
the target split and the automation switch. Admitting them is what makes the
empty cells credible; a table with a blank owner column reads as marketing."
```

---

## Task 9: TrustSection

**Files:**
- Create: `src/components/TrustSection.tsx`

- [ ] **Step 1: Write the component**

`src/components/TrustSection.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Bracket } from "@/components/Bracket";
import { ContractLink } from "@/components/ContractLink";
import { KEEPER_GUARD, VAULT_ADDRESSES } from "@/lib/chain";
import {
  ACTORS,
  PERMISSIONS,
  PERMISSION_CAPTION,
} from "@/lib/permissions";

/**
 * Who can do what to a vault, as a table.
 *
 * A table on purpose: the section above it is a flow diagram, and the five
 * sections that used to be here were all grids of bordered text cards. The
 * shape is doing work.
 *
 * Nothing here is positioned against a row count -- the matrix renders from
 * PERMISSIONS, so a row that cannot be supported by the Solidity is deleted
 * from that array and this component neither knows nor cares.
 */
export function TrustSection() {
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="trust"
      className="border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
      <div className="max-w-5xl mx-auto" ref={root}>
        <div className="font-mono text-xs text-wire-muted tracking-[0.4em] mb-2">
          {"// WHO CAN DO WHAT"}
        </div>
        <h2 className="font-mono text-2xl md:text-3xl text-wire-cyan glow-cyan mb-3 leading-snug">
          Read the permissions, not the promises.
        </h2>
        <p className="font-mono text-sm text-wire-muted leading-relaxed max-w-2xl mb-8">
          Taken from the deployed source, function by function. Where a cell is
          empty it is because no such function exists — not because one is
          guarded.
        </p>

        <div className="relative border border-wire-cyan/25 bg-wire-card">
          <Bracket at="tl" />
          <Bracket at="tr" />
          <Bracket at="bl" />
          <Bracket at="br" />

          <div className="flex items-center gap-3 border-b border-wire-cyan/20 px-4 sm:px-6 py-2.5 font-mono text-[10px] tracking-[0.26em] text-wire-muted">
            <span className="text-wire-cyan glow-cyan">▸ PERMISSION MAP</span>
            <span className="ml-auto text-wire-muted/70 whitespace-nowrap">
              BlurVault · KeeperGuard
            </span>
          </div>

          <div className="p-4 sm:p-7 overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr>
                  <th className="text-left" />
                  {ACTORS.map((a) => (
                    <th
                      key={a.key}
                      className="font-mono text-[10px] font-normal text-wire-muted/70 tracking-[0.14em] text-center pb-2.5 px-1 border-b border-wire-cyan/25"
                    >
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((row, i) => (
                  <tr
                    key={row.action}
                    className={seen ? "figure-in" : "opacity-0"}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <td className="font-mono text-[10px] text-wire-cyan tracking-[0.1em] py-2.5 pr-4 border-b border-wire-cyan/8">
                      {row.action}
                    </td>
                    {ACTORS.map((a) => {
                      const yes = row.can.includes(a.key);
                      return (
                        <td
                          key={a.key}
                          className="text-center py-2.5 px-1 border-b border-wire-cyan/8"
                        >
                          <span
                            className={
                              yes
                                ? "text-wire-cyan text-[13px] [text-shadow:0_0_8px_rgba(214,254,81,0.6)]"
                                : "text-wire-cyan/15 text-[13px]"
                            }
                            title={yes ? "can" : "no such function"}
                          >
                            {yes ? "●" : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 pt-4 border-t border-wire-cyan/15">
              <div className="font-mono text-sm text-wire-cyan">
                {PERMISSION_CAPTION.lead}
              </div>
              <div className="font-mono text-xs text-wire-muted leading-relaxed mt-2 max-w-3xl">
                {PERMISSION_CAPTION.body}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-wire-cyan/20 px-4 sm:px-7 py-4">
            <span className="font-mono text-[9px] text-wire-muted/70 tracking-[0.22em]">
              VERIFIED SOURCE
            </span>
            <ContractLink
              address={VAULT_ADDRESSES.balanced}
              label="BLURVAULT"
              variant="bare"
            />
            <ContractLink
              address={KEEPER_GUARD}
              label="KEEPERGUARD"
              variant="bare"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: typecheck clean; no new lint errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrustSection.tsx
git commit -m "feat: trust section — the permission matrix as a table"
```

---

## Task 10: Swap the sections on the page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/VaultPreview.tsx` (the `<section>` id)
- Delete: `src/components/CommandsSection.tsx`, `src/components/GuideSection.tsx`, `src/components/SecuritySection.tsx`

- [ ] **Step 1: Move the `vaults` anchor onto VaultPreview**

In `src/components/VaultPreview.tsx`, change the opening `<section>` tag from:

```tsx
    <section
      id="preview"
      className="relative border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
```

to:

```tsx
    {/* Carries id="vaults" as well: the nav links to /#vaults, and the section
        that used to own that anchor is gone. This is now the vaults section. */}
    <section
      id="vaults"
      className="relative border-b border-wire-border px-4 sm:px-6 md:px-8 py-16 md:py-24 scroll-mt-16"
    >
```

- [ ] **Step 2: Rewrite the page**

Replace the body of `src/app/page.tsx` with:

```tsx
import { NavBar } from "@/components/NavBar";
import { HeroSection } from "@/components/HeroSection";
import { TickerMarquee } from "@/components/TickerMarquee";
import { VaultPreview } from "@/components/VaultPreview";
import { AboutSection } from "@/components/AboutSection";
import { MechanicsSection } from "@/components/MechanicsSection";
import { TrustSection } from "@/components/TrustSection";
import { TokenSection } from "@/components/TokenSection";
import { LiveFeed } from "@/components/LiveFeed";
import { Footer } from "@/components/Footer";
import { MatrixScroll } from "@/components/MatrixScroll";
import { AnimationGovernor } from "@/components/AnimationGovernor";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-wire-cyan overflow-x-hidden page-enter">
      <MatrixScroll />
      <AnimationGovernor />
      <NavBar />
      <HeroSection />
      <TickerMarquee />
      {/* Straight after the fold: the product itself, before any prose. */}
      <VaultPreview />
      <AboutSection />
      {/* The two sections that are not grids of text cards. Mechanics replaces
          a duplicate of the vault preview and absorbs the old flywheel; trust
          absorbs the old security cards. */}
      <MechanicsSection />
      <TrustSection />
      <TokenSection />
      <LiveFeed />
      <Footer />
    </main>
  );
}
```

- [ ] **Step 3: Delete the three superseded sections**

```bash
git rm src/components/CommandsSection.tsx \
       src/components/GuideSection.tsx \
       src/components/SecuritySection.tsx
```

- [ ] **Step 4: Check nothing still imports them**

Run:

```bash
grep -rn "CommandsSection\|GuideSection\|SecuritySection" src/ || echo "no references remain"
```

Expected: `no references remain`

- [ ] **Step 5: Check the nav's anchors all resolve**

Run:

```bash
grep -oE 'href="/#[a-z]+"' src/components/NavBar.tsx | sort -u
```

Expected: `/#vaults`, `/#flywheel`, `/#token`, `/#feed`.

`#flywheel` was `GuideSection`, which is gone. In `src/components/NavBar.tsx`, change that nav item to point at the section that absorbed it:

```tsx
        <Link href="/#mechanics" className="hover:text-wire-cyan hover:glow-cyan transition-all">
          HOW IT WORKS
        </Link>
```

- [ ] **Step 6: Confirm every remaining anchor has a target**

Run:

```bash
for a in vaults mechanics token feed; do
  printf "%-10s " "$a"
  grep -rq "id=\"$a\"" src/components/ && echo "ok" || echo "MISSING"
done
```

Expected: four lines, all `ok`.

- [ ] **Step 7: Full check**

Run: `npm run check`
Expected: address check passes, lint reports 0 errors, typecheck clean, build compiles.

If the dev server is running, stop it first — a build alongside `next dev` leaves the dev server serving stale SSR, which has caused false "my change didn't apply" hunts in this repo before.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace the duplicated strategy section with mechanics and trust

CommandsSection repeated VaultPreview -- same three strategies, same
splits, same call to action. GuideSection and SecuritySection are absorbed
rather than left alongside, so nine blocks become eight and two of the
eight are not grids of text cards.

id=\"vaults\" moves to VaultPreview and the HOW IT WORKS nav item points at
the mechanics section, so no nav link scrolls to nothing."
```

---

## Task 11: Verify in a browser

Nothing above proves the thing looks right or that the links go anywhere real.

**Files:** none — verification only.

- [ ] **Step 1: Build and serve production**

```bash
pkill -f "next dev"; sleep 1
npm run build && npm run start
```

- [ ] **Step 2: Check every address on screen against DEPLOYMENTS.md**

Open `http://localhost:3000`, scroll to the mechanics section, and hover each chip — the `title` attribute holds the full address. Compare each against `contracts/DEPLOYMENTS.md`:

| On screen | Must be |
|---|---|
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| BLUR VAULT | `0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7` |
| LENDING LEG | `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` |
| STOCK BASKET | `0x8449202B6525F9632eB25809B91B50c1820fAAE4` |
| ORACLE | `0x932aa45036045540dbfab7252bd3398f35f32e76` |
| KEEPER GUARD | `0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613` |
| EXIT ROUTER | `0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0` |

None may appear in the "Superseded" table.

- [ ] **Step 3: Open one link and confirm it is the right contract**

Click the BLUR VAULT chip. Expected: Blockscout opens at that address, shows verified source, and the contract name is `BlurVault`.

- [ ] **Step 4: Confirm the motion behaves**

- Reload at the top of the page; scroll down. The diagram and the trace rows should fade and rise on arrival, not before.
- Watch a connector: a dot travels it on a loop.
- Scroll the section fully off screen. Run this in the console — `AnimationGovernor` should have paused the dots:

```js
document.getAnimations().filter(a => a.animationName === "flowDot").map(a => a.playState)
```

Expected: `["paused", "paused"]`

- [ ] **Step 5: Confirm the trust table survives losing rows**

Temporarily delete two entries from `PERMISSIONS` in `src/lib/permissions.ts`, reload, and look at the section. Expected: the panel still reads as finished — header, table, caption, footer, all four corner brackets. Then restore the rows.

- [ ] **Step 6: Check the three breakpoints**

Resize to 390 px, 768 px and 1600 px. Expected:
- At 390 the diagram is stacked vertically and the permission table scrolls horizontally inside its panel — the page itself never scrolls sideways.
- At 768 and above the diagram is horizontal.

- [ ] **Step 7: Commit anything the check turned up**

```bash
git add -A && git commit -m "fix: corrections from browser verification" || echo "nothing to fix"
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: file structure → Tasks 1–9; page order and the moved anchor → Task 10; glyphs → Task 4; contracts linked → Task 3; the verification gate → done up front, recorded in Task 8's data with a `source` on every row; "surviving the facts" → Task 11 Step 5 tests it directly; error handling (null address) → Task 6; testing → Tasks 3 and 11.

**Deviation from the spec, deliberate.** The spec sketched a code band under the matrix showing a struck-through absent function. It is not in this plan. Reading the contracts produced something better: three real owner powers. The caption now carries the argument, and a mocked-up snippet of Solidity that is not literally the deployed source would undercut a section whose whole claim is that it was read off the source. If a verbatim band is wanted later it is additive.

**Naming consistency.** `FlowNode.address`, `TraceStep.links[].address` and `ContractLinkProps.address` are all `Address | null`. `PixelLogo` takes `grid`, and both call sites pass `GLYPH_GRID`. `PermissionRow.can` is `Actor[]` and `ACTORS[].key` is `Actor`.
