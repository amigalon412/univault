# Homepage: mechanics and trust sections

Replaces the duplicated strategy section on the homepage with two new animated
sections: a traced deposit flow that links to the live contracts, and a
permission map that shows who can do what.

## Why

`CommandsSection` (`// CHOOSE A STRATEGY`) lists STEADY / BALANCED / GROWTH
with their splits, per-leg percentages and a CHOOSE button. `VaultPreview`,
added earlier, now shows the same three strategies with the same splits, a live
allocation meter and the same call to action. The section is redundant.

It is also one of five blocks on the page built to the same shape: eyebrow,
rule, heading, paragraph, grid of bordered text cards. The page has no diagram,
no table, and no external evidence anywhere in it — the reader is asked to take
600 words of prose on trust.

The replacement does three jobs at once: removes the duplicate, breaks the
rhythm with two shapes the page does not otherwise have (a flow diagram and a
matrix), and points at the deployed contracts so the claims are checkable.

## Scope

Two new sections and two deletions.

| | |
|---|---|
| **Add** | `MechanicsSection` — traced deposit flow, contract links |
| **Add** | `TrustSection` — permission map, verified-source links |
| **Delete** | `CommandsSection` — duplicated by `VaultPreview` |
| **Delete** | `GuideSection` — absorbed by `MechanicsSection` |
| **Delete** | `SecuritySection` — absorbed by `TrustSection` |

Net effect on the page: nine sections become eight, and two of the eight are
not text-card grids.

Out of scope: the hero, the vault preview, the token section, the live feed,
the docs, anything in `/app`.

### Page order after the change

```
Hero → ticker → VaultPreview → AboutSection
    → MechanicsSection        (was CommandsSection + GuideSection)
    → TrustSection            (was SecuritySection)
    → TokenSection → LiveFeed → Footer
```

`CommandsSection` carries `id="vaults"`, which the nav bar links to as
`/#vaults`. That id moves to `VaultPreview`, which is now the section about the
vaults. Without this the nav item silently scrolls nowhere.

## Section A — MechanicsSection

Eyebrow `// HOW ONE DEPOSIT MOVES`. Heading: *Follow the money. Every box is a
contract.*

One panel, bordered and corner-bracketed like the vault preview, containing a
diagram and a numbered trace.

### Diagram

A left-to-right flow for the BALANCED vault, chosen because it is the only
strategy that exercises both legs:

```
USDG ──▶ BLUR VAULT ──┬── 60% ──▶ LENDING LEG (Steakhouse USDG)
                      └── 40% ──▶ STOCK BASKET (BasketAdapter)
```

Each node is a bordered cell holding a pixel glyph, a name, a one-line
description and an address chip that links to Blockscout. The vault is the hub:
brighter border and a glow, since everything else is entered or left through
it.

Below the diagram, a rail labelled `KEPT ON TARGET BY` with three chips —
oracle, keeper guard, exit router. These are machinery rather than a path, so
they are listed rather than wired into the flow.

### Numbered trace

Four rows inside the same panel, separated from the diagram by a rule. Each
row: number, title, one sentence, and the contract links for that step on the
right.

| # | Title | Links |
|---|-------|-------|
| 01 | You send USDG | USDG |
| 02 | The vault mints shares to your address | Vault |
| 03 | It splits itself in the same transaction | Lending venue, Basket |
| 04 | A keeper pulls it back on target | Guard, Oracle |

The wording of each sentence is written against the contracts, not against the
existing marketing copy.

### Contracts linked

All from `contracts/DEPLOYMENTS.md` and `src/lib/chain.ts`; all live on
Robinhood Chain (id 4663) and viewable on
`https://robinhoodchain.blockscout.com`.

| Node | Address | Source of truth |
|------|---------|-----------------|
| USDG | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` | `chain.ts` → `USDG` |
| Vault (BALANCED) | `0x796c05567cf6e00b3a9c453c3c67a5b2a7cd65e7` | `VAULT_ADDRESSES.balanced` |
| Lending venue | `0xBeEff033F34C046626B8D0A041844C5d1A5409dd` | `chain.ts` → `STEAK_USDG` |
| Basket adapter | `0x8449202B6525F9632eB25809B91B50c1820fAAE4` | `DEPLOYMENTS.md` |
| Oracle | `0x932aa45036045540dbfab7252bd3398f35f32e76` | `DEPLOYMENTS.md` |
| Keeper guard | `0x35304Ceb350C6ab8d93f99C002d268DbA4Ff0613` | `DEPLOYMENTS.md` |
| Exit router | `0xB31E70a57e5d59A39Ff6670845FA2308F993b7F0` | `chain.ts` → `EXIT_ROUTER` |

The vault address comes from `VAULT_ADDRESSES`, which reads the environment, so
it is null before deployment. A node whose address is null renders without its
chip rather than with a dead link — the same rule the rest of the app already
follows for undeployed vaults.

The basket adapter and oracle are not currently exported from `chain.ts`. They
are added there as constants, next to the addresses that already live in that
file, rather than being written into the component.

### Glyphs

Seven marks — coin, vault, yield, basket, oracle, guard, exit — authored as
cell matrices in the same format as `src/lib/pixel-logos.ts` and drawn by the
existing `PixelLogo` renderer. Hand-authored at 16×16 rather than sampled from
source images, because these are pictograms with no original to sample.

`PixelLogo` currently hardcodes its viewBox to `PIXEL_GRID` (26), which is the
size the company marks were sampled at. It gains an optional `grid` prop so a
16×16 pictogram renders at the right scale. That is the whole change to it.

### Motion

- Dots travel the connectors on a loop. Two connectors, staggered.
- The panel and its rows fade and rise when the section scrolls into view.

Both are CSS. The travelling dots are infinite and therefore governed by
`AnimationGovernor`, which already pauses infinite animations off-screen and in
background tabs. The reveal is one-shot and ends on its own.

## Section B — TrustSection

Eyebrow `// WHO CAN DO WHAT`. Heading: *Read the permissions, not the
promises.*

One panel: a permission matrix, a caption, an optional code band, and a footer
of links to verified sources.

### The matrix

Actions down the side, actors across the top: **you**, **keeper**, **owner**,
**anyone**. A filled dot means a function exists and this actor can call it. A
dash means no such function exists for that actor.

Candidate rows — deposit, redeem your shares, move the assets out, block an
exit, rebalance to target, change the target split. Which rows survive is
decided by reading the contracts, not by what makes the best argument.

### Verification gate

**No cell is written from memory or from existing site copy.** Before the
component is built, `BlurVault.sol` and `KeeperGuard.sol` are read and each
cell is filled from the actual function set and modifiers. A row that cannot be
supported by a specific function or a specific absence is deleted.

This matters because the existing copy hedges — "designed so a compromised
keeper can't touch your principal", "designed to apply only to gains" — and
hedged prose must not become an unhedged dot in a table.

### Surviving the facts

The section is built so that losing rows or losing the code band leaves
something that still looks finished:

- **Rows are data.** The matrix renders from an array. Four rows or seven, the
  panel is the same panel; nothing is positioned against a row count.
- **The caption is written last**, and states whatever the grid actually
  proves. No sentence depends on the owner column being empty.
- **The code band is optional.** It is a band inside the panel, not a section
  of its own. If the source yields no clean two-or-three-line proof, the band
  is omitted and the footer closes the panel.
- **The footer always ships.** Links to the verified source are true whatever
  the grid says, so the panel always has a closing edge.

### Motion

Rows fade and rise in sequence on scroll-in, one-shot, ~50 ms apart. Nothing
runs afterwards.

## Components

| File | Responsibility |
|------|----------------|
| `src/components/MechanicsSection.tsx` | Section A: diagram, rail, numbered trace |
| `src/components/TrustSection.tsx` | Section B: matrix, caption, code band, footer |
| `src/components/ContractLink.tsx` | One address chip: truncation, explorer URL, null handling |
| `src/lib/pixel-glyphs.ts` | The seven pictogram matrices |
| `src/lib/mechanics.ts` | Flow nodes and trace steps as data |
| `src/lib/permissions.ts` | Matrix rows as data, with the source note for each |

Splitting the data out of the components is what makes the verification gate
workable: the rows can be corrected against the contracts without touching
layout, and a wrong claim is a one-line deletion.

`ContractLink` exists because a truncated address that links to the right
explorer and disappears when the address is null is needed in both sections and
is easy to get subtly wrong twice.

## Reuse

- `PixelLogo` renders the new glyphs — no new renderer.
- `pixelLevels` in `src/lib/pixel-grid.ts` already groups cells into paths.
- `explorerAddressUrl` in `src/lib/chain.ts` builds the links.
- `.figure-in` in `globals.css` is the existing reveal animation, applied once
  the observer fires rather than on mount.
- The panel chrome — hairline border, corner brackets, header strip, footer —
  follows `VaultPreview`, so the three panels on the page read as a set.

The corner bracket is currently a private `Bracket` in `VaultPreview.tsx`.
Three panels need it, so it moves to `src/components/Bracket.tsx` and
`VaultPreview` imports it. This is the only change to existing components
beyond the deletions and the moved `id`.

## Error handling

- **Null vault address** (before deploy, or a missing env var): the node
  renders without its chip. No dead link, no empty box.
- **Explorer unreachable**: links are plain anchors with
  `target="_blank" rel="noopener noreferrer"`. Nothing on the page depends on
  the explorer being up.
- **No network calls, no chain reads.** Every address is a build-time constant.
  Neither section can spin, fail or go stale; there is no loading state and no
  error state to design.

Both are client components, because the reveal is triggered by an
`IntersectionObserver` — these sections sit well below the fold, and a
mount-triggered CSS animation would be over before anyone scrolled to them.
Each holds one observer that sets one boolean and disconnects, the same shape
`VaultPreview` already uses. Nothing else about them is dynamic.

## Testing

Manual, in a production build, on a page that is not being served stale SSR:

1. Every address chip opens the right contract on Blockscout.
2. Every address on screen matches `DEPLOYMENTS.md` character for character.
3. Each matrix cell traces to a named function or a named absence.
4. Rows and steps reveal on scroll; the travelling dots pause when the section
   is off-screen and when the tab is in the background.
5. Delete two rows from `permissions.ts` and drop the code band: the section
   still looks complete.
6. `npm run check` — lint, typecheck, build.
7. Layouts hold at 390 px, 768 px and 1600 px.

## Risks

**The matrix overstates.** The one that matters. Mitigated by the verification
gate and by keeping rows as data so a bad row is a one-line deletion.

**The diagram implies BALANCED is the only vault.** The panel header says
`BALANCED · 60 / 40` and the split is labelled, so the reader can see it is one
strategy of three; the vault preview immediately above shows all three.

**Deleting three sections removes copy someone wanted.** The strongest lines
from the deleted sections are carried into the new ones; the rest was
restating the vault preview.
