/**
 * Whether a block belongs to the world before $SAFEX exists or after it does.
 *
 * Blocks without a phase are shown in both. The phase is decided per request
 * from the address published in /admin, so launch day is one paste in the
 * admin panel and nothing else: no edit here, no rebuild, no redeploy. The
 * alternative -- writing "the token is live" ahead of time so it is one less
 * thing to do later -- would put a claim on the docs that the site's own
 * header calls a scam for the entire window before launch.
 */
export type DocPhase = "pre-launch" | "post-launch";

/** Replaced with the published $SAFEX address wherever it appears in copy. */
export const CA_TOKEN = "%CA%";

export type DocBlock = (
  | { type: "p"; text: string }
  | { type: "list"; items: { lead?: string; text: string }[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "code"; lines: string[] }
  | { type: "note"; text: string }
) & { only?: DocPhase };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocPage {
  slug: string;
  title: string;
  /** Lead paragraphs shown above the first section. */
  intro: string[];
  /** Replaces `intro` once the token is live. Omit when the lead is unaffected. */
  introWhenLaunched?: string[];
  sections: DocSection[];
}

export interface DocGroup {
  label: string;
  pages: DocPage[];
}

export const DOC_GROUPS: DocGroup[] = [
  {
    label: "INTRODUCTION",
    pages: [
      {
        slug: "overview",
        title: "Overview",
        intro: [
          "SAFEX is an auto-yield vault that runs on BNB Chain. You put a stablecoin in once; from that moment the vault does the work — it lends the balance out for real interest, moves a slice of it into a curated basket of tokenized stock tokens, and keeps pulling itself back to whatever split you picked.",
          "Nothing about that requires you to hand over control. Your position is a token balance at your own address, and the exit path is open to you at any block.",
        ],
        sections: [
          {
            id: "what-it-does",
            title: "What it does for you",
            blocks: [
              {
                type: "p",
                text: "Most stablecoin balances sit still and earn nothing. SAFEX turns that dead weight into a portfolio that maintains itself.",
              },
              {
                type: "list",
                items: [
                  {
                    lead: "Interest, not emissions.",
                    text: "The base return comes from borrowers paying to use your stablecoin, so it does not depend on a token printer staying switched on.",
                  },
                  {
                    lead: "Hands off.",
                    text: "Your deposit allocates itself on the way in. Drift is corrected afterwards by a keeper that is capped by contract. You are not asked to time anything.",
                  },
                  {
                    lead: "Exit is yours.",
                    text: "Redemption is permissionless and can be paid in-kind. No queue, no approval, no admin in the way.",
                  },
                  {
                    lead: "One fee, on gains only.",
                    text: "5% of profit above your high-water mark. If the vault has not made you money, it does not charge you.",
                  },
                ],
              },
            ],
          },
          {
            id: "who-it-is-for",
            title: "Who it is for",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    text: "Anyone holding stablecoins that currently earn nothing and would rather not babysit a position.",
                  },
                  {
                    text: "People who want some equity exposure without opening a chart every morning.",
                  },
                  {
                    text: "Savers who want the portfolio to run itself but refuse to give up custody to get that.",
                  },
                ],
              },
            ],
          },
          {
            id: "in-one-line",
            title: "In one line",
            blocks: [{ type: "p", text: "Grow your bag, automatically." }],
          },
        ],
      },
      {
        slug: "how-it-works",
        title: "How it works",
        intro: [
          "The vault is an ERC-4626 contract. Deposits mint shares, redemptions burn them, and the share price tracks the value of everything the vault holds.",
        ],
        sections: [
          {
            id: "the-loop",
            title: "The loop",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "1 — Deposit.",
                    text: "You send USDG and receive vault shares. The share price at that moment sets your cost basis.",
                  },
                  {
                    lead: "2 — Deploy.",
                    text: "In the same transaction: the stablecoin portion is supplied to a lending market and the equity portion is bought into the basket. Your deposit is working before the call returns.",
                  },
                  {
                    lead: "3 — Maintain.",
                    text: "As prices move, the split drifts. The keeper trades it back toward target and compounds accrued interest.",
                  },
                  {
                    lead: "4 — Exit.",
                    text: "Burn shares, receive your pro-rata slice — either sold back to stablecoin or handed over in-kind.",
                  },
                ],
              },
            ],
          },
          {
            id: "what-you-hold",
            title: "What you actually hold",
            blocks: [
              {
                type: "p",
                text: "You hold shares, not a fixed claim on a number of dollars. A share is a proportional claim on the whole vault: the lent stablecoin, the accrued interest and the basket. Shares are transferable like any other token.",
              },
            ],
          },
        ],
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        intro: [
          "Four steps from an idle balance to a running position. It takes about a minute.",
        ],
        sections: [
          {
            id: "steps",
            title: "Steps",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "Connect.",
                    text: "Open the terminal and connect a wallet holding USDG on BNB Chain.",
                  },
                  {
                    lead: "Pick a split.",
                    text: "Steady, Balanced or Growth. You can move between them later.",
                  },
                  {
                    lead: "Approve and deposit.",
                    text: "One approval for the amount you choose, then the deposit itself. Shares arrive in the same transaction.",
                  },
                  {
                    lead: "Leave it.",
                    text: "The deposit allocates itself in that same transaction; from there the keeper handles drift. Check in whenever you feel like it.",
                  },
                ],
              },
              {
                type: "note",
                text: "Approve only what you intend to deposit. An unlimited approval is convenient and is also the single most common way people lose funds on-chain.",
              },
            ],
          },
        ],
      },
      {
        slug: "key-concepts",
        title: "Key concepts",
        intro: ["The vocabulary used throughout these docs."],
        sections: [
          {
            id: "glossary",
            title: "Glossary",
            blocks: [
              {
                type: "table",
                head: ["Term", "Meaning"],
                rows: [
                  ["Share", "Your claim on the vault, issued as an ERC-20 balance"],
                  ["NAV", "Total value of everything the vault holds, priced in USD"],
                  ["Split", "Target ratio between lent stablecoin and the equity basket"],
                  ["Drift", "How far the live split has wandered from that target"],
                  ["Keeper", "The off-chain bot allowed to harvest and rebalance, nothing else"],
                  ["High-water mark", "The peak share price your position has reached, used for fees"],
                  ["In-kind", "Redeeming into the underlying tokens instead of selling them first"],
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "VAULTS",
    pages: [
      {
        slug: "strategies",
        title: "Strategies",
        intro: [
          "Three vaults, one decision: how much of your balance chases the market. Every one of them keeps a stablecoin floor that earns regardless of what equities do.",
        ],
        sections: [
          {
            id: "the-three",
            title: "The three splits",
            blocks: [
              {
                type: "table",
                head: ["Vault", "Lending", "Basket", "Suits"],
                rows: [
                  ["STEADY", "100%", "0%", "Cash you may need back soon"],
                  ["BALANCED", "60%", "40%", "A default for most balances"],
                  ["GROWTH", "30%", "70%", "Money you can leave alone for years"],
                ],
              },
              {
                type: "p",
                text: "Vaults are separate contracts. A problem in one does not spill into the others, and each has its own share price and TVL.",
              },
            ],
          },
          {
            id: "switching",
            title: "Switching",
            blocks: [
              {
                type: "p",
                text: "There is no migrate button. Redeem from one vault and deposit into another. That costs you the round-trip in fees and spread, so pick a split you can leave alone rather than one you plan to adjust.",
              },
            ],
          },
        ],
      },
      {
        slug: "deposits",
        title: "Deposits",
        intro: [
          "Deposits are permissionless. Anyone holding USDG on BNB Chain can mint shares at the current price.",
        ],
        sections: [
          {
            id: "pricing",
            title: "How your shares are priced",
            blocks: [
              {
                type: "code",
                lines: [
                  "shares = assets × totalSupply / totalAssets()",
                  "",
                  "// the first deposit into an empty vault mints 1:1",
                ],
              },
              {
                type: "p",
                text: "Because the price is read at execution time, you cannot dilute existing holders by depositing, and they cannot dilute you.",
              },
            ],
          },
          {
            id: "landing",
            title: "Where the money goes first",
            blocks: [
              {
                type: "p",
                text: "A deposit splits itself in the same transaction that mints your shares: the stablecoin portion is supplied to the lending market and the equity portion is bought into the basket before the call returns. Nothing sits idle waiting for a bot, and you pay the gas for your own allocation rather than sharing someone else's.",
              },
              {
                type: "note",
                text: "There is no minimum and no lockup. Depositing and redeeming in the same block is allowed — it simply costs you gas and spread.",
              },
            ],
          },
        ],
      },
      {
        slug: "withdrawals",
        title: "Withdrawals",
        intro: [
          "Redemption is a plain contract call. No queue, no notice period, and no address that can stop you.",
        ],
        sections: [
          {
            id: "two-ways",
            title: "Two ways out",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "In stablecoin.",
                    text: "The vault unwinds your slice and pays USDG. Simple, and you wear the spread on whatever has to be sold.",
                  },
                  {
                    lead: "In-kind.",
                    text: "The vault transfers your pro-rata share of each holding directly. Nothing is sold, so nothing is lost to slippage — and it works when equity markets are shut.",
                  },
                ],
              },
            ],
          },
          {
            id: "why-in-kind",
            title: "Why in-kind matters",
            blocks: [
              {
                type: "p",
                text: "A vault that can only pay out by selling is a vault that can be forced into selling at the worst possible moment. In-kind redemption removes that failure mode: the exit does not depend on there being a buyer.",
              },
            ],
          },
        ],
      },
      {
        slug: "shares-and-nav",
        title: "Shares & NAV",
        intro: [
          "NAV is the total value of the vault's holdings. Share price is NAV divided by shares outstanding. Everything else is bookkeeping around those two numbers.",
        ],
        sections: [
          {
            id: "how-nav",
            title: "How NAV is computed",
            blocks: [
              {
                type: "code",
                lines: [
                  "totalAssets = idleStable",
                  "            + lendingBalance      // principal + accrued interest",
                  "            + basketValue         // Σ position × oracle price",
                  "",
                  "sharePrice  = totalAssets / totalSupply",
                ],
              },
              {
                type: "p",
                text: "Equity positions are marked with an oracle. If a price feed goes stale, the paths that depend on it refuse to run rather than trading on a number nobody trusts.",
              },
            ],
          },
          {
            id: "reading-it",
            title: "Reading your position",
            blocks: [
              {
                type: "p",
                text: "Your share count never changes on its own — it moves only when you deposit or redeem. Returns show up as a rising share price. If your balance is unchanged and your dollar value went up, that is the vault working.",
              },
            ],
          },
        ],
      },
      {
        slug: "rebalancing",
        title: "Rebalancing",
        intro: [
          "Prices move, so the split drifts. Rebalancing is the act of trading it back — and it is the closest thing the protocol has to a strategy.",
        ],
        sections: [
          {
            id: "trigger",
            title: "When it fires",
            blocks: [
              {
                type: "p",
                text: "Rebalancing is threshold-based, not scheduled. The keeper acts once drift crosses a band rather than trading on a timer, which keeps the vault from paying spread on noise.",
              },
              {
                type: "table",
                head: ["Condition", "Result"],
                rows: [
                  ["Drift inside the band", "Nothing happens"],
                  ["Drift outside the band", "Trade back toward target"],
                  ["Oracle stale", "Refuse to trade"],
                  ["Quote worse than the slippage cap", "Refuse to trade"],
                ],
              },
            ],
          },
          {
            id: "effect",
            title: "What it does to returns",
            blocks: [
              {
                type: "p",
                text: "Rebalancing sells what has run and buys what has lagged. In a choppy market that is a mild tailwind; in a market that trends in one direction for a long time it will lag simply holding the winner. That trade is deliberate — it is what keeps the risk you signed up for from quietly drifting into a different one.",
              },
            ],
          },
        ],
      },
      {
        slug: "market-hours",
        title: "Market hours",
        intro: [
          "Lending runs continuously. Tokenized equities track instruments that do not — and the vault is built around that gap rather than pretending it does not exist.",
        ],
        sections: [
          {
            id: "closed",
            title: "When the market is shut",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Deposits and redemptions stay open." },
                  { text: "The lending leg keeps accruing as normal." },
                  {
                    text: "Basket rebalancing waits — liquidity outside session hours is thin and the price is unreliable.",
                  },
                  {
                    text: "In-kind redemption is the clean exit, since it needs no trade at all.",
                  },
                ],
              },
              {
                type: "note",
                text: "Expect wider spreads and larger gaps around the open. If you are moving a meaningful amount, session hours are the cheaper time to do it.",
              },
            ],
          },
        ],
      },
      {
        slug: "fees",
        title: "Fees",
        intro: [
          "One fee: 5% of profit, above a high-water mark. No management fee, no deposit fee, no exit fee.",
        ],
        sections: [
          {
            id: "hwm",
            title: "How the high-water mark works",
            blocks: [
              {
                type: "p",
                text: "The vault records the highest share price it has reached. Fees are only charged on gains above that line. If the share price falls and later recovers, the recovery is free — you are not charged twice for the same dollar.",
              },
              {
                type: "table",
                head: ["Event", "Share price", "Fee charged"],
                rows: [
                  ["Start", "1.00", "—"],
                  ["Gain", "1.10", "5% of 0.10"],
                  ["Drawdown", "0.95", "none"],
                  ["Back to 1.10", "1.10", "none — still below the mark"],
                  ["New high", "1.20", "5% of 0.10"],
                ],
              },
            ],
          },
          {
            id: "where-it-goes",
            title: "Where the fee goes",
            blocks: [
              {
                type: "p",
                only: "pre-launch",
                text: "Collected fees are the intended funding for the buyback: revenue buys $SAFEX on the open market and what is bought is burned, so usage feeds the token instead of the other way round. Until the buyback module is wired in, fees accrue to the fee recipient.",
              },
              {
                type: "p",
                only: "post-launch",
                text: "Collected fees fund the buyback: revenue is used to purchase $SAFEX on the open market, and what is bought is burned. Usage feeds the token instead of the other way round. The buyback module is not deployed yet, so until it is, fees accrue to the fee recipient rather than being spent.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "AUTOMATION",
    pages: [
      {
        slug: "keeper",
        title: "The keeper",
        intro: [
          "The keeper is an off-chain bot that does the boring work: harvesting interest and trading drift back to target. Allocating a deposit is no longer part of its job — a deposit does that itself, in the transaction that mints your shares — so nothing you put in is waiting on a bot to start earning.",
          "It is still the part of the system most worth being paranoid about, so it is the part with the tightest leash.",
        ],
        sections: [
          {
            id: "can",
            title: "What it can do",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Harvest accrued lending interest back into the vault." },
                  { text: "Trade toward the target split when drift crosses the band." },
                ],
              },
            ],
          },
          {
            id: "cannot",
            title: "What it cannot do",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Send funds to any address of its choosing." },
                  { text: "Trade into an asset that is not on the allowlist." },
                  { text: "Exceed the per-transaction size cap or the slippage cap." },
                  { text: "Act on a stale oracle price, or act again before the cooldown expires." },
                  { text: "Change the target split, the fee, or any of the limits above." },
                ],
              },
              {
                type: "note",
                text: "The worst case if the keeper key is stolen is bounded: an attacker can waste value inside the slippage and size caps. They cannot walk off with the principal, because no code path lets them.",
              },
            ],
          },
        ],
      },
      {
        slug: "auto-save",
        title: "Goals & auto-save",
        intro: [
          "Not built. This page describes an intended design so it can be judged before it exists, not a feature you can use.",
        ],
        sections: [
          {
            id: "status",
            title: "Status",
            blocks: [
              {
                type: "note",
                text: "There is no auto-save contract, on any network. The card on the app page says the same. When it ships, this page will describe what was built rather than what was planned.",
              },
            ],
          },
          {
            id: "how",
            title: "How it would be set up",
            blocks: [
              {
                type: "p",
                text: "Scheduled dollar-cost averaging: you would grant an allowance for a specific amount and set an interval and a target. The scheduler could move that allowance and nothing else — not the rest of the wallet, not more than the total set — and would stop once the goal was reached.",
              },
              {
                type: "p",
                text: "Cancelling would be a matter of revoking the allowance: immediate, and needing nobody's cooperation. That property is the reason for the shape, and it is what the implementation will be judged against.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "$SAFEX",
    pages: [
      {
        slug: "safex-token",
        title: "$SAFEX overview",
        intro: [
          "$SAFEX is the protocol token. It is tied to the vaults by the buyback: fee revenue is spent buying it on the open market, and what is bought is burned.",
        ],
        introWhenLaunched: [
          "$SAFEX is the protocol token, live on BNB Chain at %CA%. It is tied to the vaults by the buyback: fee revenue is spent buying it on the open market, and what is bought is burned.",
        ],
        sections: [
          {
            id: "utility",
            title: "What backs it",
            blocks: [
              {
                type: "p",
                text: "The link between the token and the protocol is the buyback. Fee revenue is spent buying $SAFEX on the open market, and the contract burns what it buys. More assets under management means more fees, which means more buying pressure that did not come from a narrative.",
              },
              {
                type: "note",
                text: "That is a description of a mechanism, not a promise about price. A buyback funded by fees is only as large as the fees.",
              },
              {
                type: "note",
                only: "pre-launch",
                text: "Burned means burned: the module calls burn on the token, so totalSupply falls by exactly the amount bought rather than a transfer to a dead address dressed up as a burn. It also keeps its own totalRetired counter, and the two should move together.",
              },
              {
                type: "note",
                only: "post-launch",
                text: "Burned means burned: the module calls burn on the token, so totalSupply falls by exactly the amount bought and you can check it against %CA% yourself. It is not a transfer to a dead address dressed up as a burn. The module also keeps its own totalRetired counter, and the two should move together.",
              },
            ],
          },
        ],
      },
      {
        slug: "tokenomics",
        title: "Tokenomics",
        intro: ["Supply, distribution and the flow of value through the token."],
        sections: [
          {
            id: "flow",
            title: "The flywheel",
            blocks: [
              {
                type: "code",
                lines: [
                  "deposits --> TVL --> yield --> 5% performance fee",
                  "                                      |",
                  "                                      v",
                  "                           buy $SAFEX on the market",
                  "                                      |",
                  "                           +----------+----------+",
                  "                           |                     |",
                  "                           v                     v",
                  "                          burn            holder incentives",
                ],
              },
              {
                type: "p",
                text: "Every arrow in that diagram is driven by usage. Nothing in it depends on new buyers arriving.",
              },
            ],
          },
          {
            id: "supply",
            title: "Supply",
            blocks: [
              {
                type: "p",
                only: "pre-launch",
                text: "Supply is fixed — there is no inflation schedule and no emissions programme, which is the point of funding incentives out of revenue instead of out of a printer. The address to verify supply against is published in the site header.",
              },
              {
                type: "p",
                only: "post-launch",
                text: "Supply is fixed — there is no inflation schedule and no emissions programme, which is the point of funding incentives out of revenue instead of out of a printer. Current supply and distribution are published on-chain: read them off %CA% rather than taking this page's word for it.",
              },
            ],
          },
        ],
      },
      {
        slug: "launch",
        title: "Launch",
        intro: [
          "The vaults are live on BNB Chain, all twelve contracts source-verified on the explorer. This page is the order of events.",
        ],
        introWhenLaunched: [
          "The vaults and $SAFEX are both live on BNB Chain. The token is at %CA% — that address, published here and in the site header, is the only one that is ours.",
        ],
        sections: [
          {
            id: "order",
            title: "Order of events",
            blocks: [
              {
                type: "table",
                head: ["Stage", "Status"],
                only: "pre-launch",
                rows: [
                  ["Vault contracts on mainnet", "Done — all twelve source-verified"],
                  ["Vault terminal", "Live"],
                  ["Mainnet deposits", "Open"],
                  ["Audit", "Not started"],
                ],
              },
              {
                type: "table",
                only: "post-launch",
                head: ["Stage", "Status"],
                rows: [
                  ["Vault contracts on mainnet", "Done — all twelve source-verified"],
                  ["Vault terminal", "Live"],
                  ["Mainnet deposits", "Open"],
                  ["$SAFEX on BNB Chain", "Live"],
                  ["Audit", "Not started"],
                ],
              },
              {
                type: "note",
                text: "Deposits are open and the contracts have not been audited. Verified source is not an audit: it proves the code on the explorer is the code that is running, and proves nothing about whether that code is safe. Read Audits before you deposit.",
              },
              {
                type: "note",
                only: "post-launch",
                text: "$SAFEX is at %CA%. Check any address you are given against this page and the site header before you buy — an address posted in a reply, a DM or a lookalike account is the oldest trick there is, and nobody here will ever send you one privately.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "SECURITY",
    pages: [
      {
        slug: "security-model",
        title: "Security model",
        intro: [
          "The claim is narrow and precise: no address, including ours, has a code path that moves your funds. Everything below is what makes that true rather than marketing.",
        ],
        sections: [
          {
            id: "principles",
            title: "Principles",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "No admin transfer path.",
                    text: "No function moves assets to an address a caller chooses — not for a holder, not for the keeper, not for the owner. The basket adapter is the one contract that ever receives funds to trade with, and it is fixed once, before the vault has issued a single share. It cannot be swapped afterwards. The slippage a rebalance may accept is a constant in the code rather than an argument, so a trade cannot be routed through a pool priced to suit and settled at any price. This is a claim about our contracts; it does not bind the issuer of an asset we hold.",
                  },
                  {
                    lead: "Exit cannot be paused.",
                    text: "Redemption has no pause switch. A protocol you cannot leave during a crisis is a protocol you do not control.",
                  },
                  {
                    lead: "Automation is bounded.",
                    text: "The keeper role is deliberately small. See Guardrails for the specific limits.",
                  },
                  {
                    lead: "Fail closed.",
                    text: "When an oracle is stale or a quote is bad, the vault does nothing. Doing nothing is always available and is usually right.",
                  },
                ],
              },
            ],
          },
          {
            id: "custody",
            title: "A note on custody",
            blocks: [
              {
                type: "note",
                text: "The equity leg is the exception, and it is not a small one. Stock tokens let their issuer pause transfers, burn balances and block addresses. Nobody can take your shares in this vault, but the assets behind them are not beyond the issuer's reach. Only the lending leg is free of that.",
              },
              {
                type: "p",
                text: "If you sign in with a social login, an embedded wallet is created for you and the provider holds a key share. That is a real trade-off and we would rather name it than hide it: it removes the seed phrase you can lose, and it adds a party to the signing process. Connect your own signer if you would rather not make that trade. Either way the protocol's guarantee is unchanged, because it is a statement about the contracts, not about where your key lives.",
              },
            ],
          },
        ],
      },
      {
        slug: "guardrails",
        title: "Guardrails",
        intro: [
          "The specific limits enforced on-chain before any automated action is allowed to execute.",
        ],
        sections: [
          {
            id: "checks",
            title: "Checks on every keeper call",
            blocks: [
              {
                type: "table",
                head: ["Guard", "Enforces"],
                rows: [
                  ["Caller allowlist", "Only a registered keeper may call"],
                  ["Asset allowlist", "Trades may only touch approved tokens"],
                  ["Size cap", "Maximum notional per transaction"],
                  ["Slippage cap", "Minimum output relative to the quote"],
                  ["Oracle freshness", "Price must be newer than the staleness limit"],
                  ["Cooldown", "Minimum interval between actions"],
                ],
              },
              {
                type: "p",
                text: "These are parameters, not code paths — they can be tightened by governance, but no setting turns them off entirely, and none of them unlocks a transfer to an address of anyone's choosing. What the owner can still do is make the vault trade when it need not: move the target split, or point a constituent at a different pool for the same pair. Both lose spread, both are bounded by the slippage ceiling, and neither is theft.",
              },
            ],
          },
        ],
      },
      {
        slug: "audits",
        title: "Audits",
        intro: ["Current status: no audit has been completed."],
        sections: [
          {
            id: "status",
            title: "Where things stand",
            blocks: [
              {
                type: "p",
                text: "The vault contracts have not been audited. No report exists, and none is scheduled for publication yet. Deposits are open anyway, so this page is the risk you are taking rather than a future concern.",
              },
              {
                type: "note",
                text: "Treat any claim that SAFEX is audited as false until a report is linked from this page. This page is the only place we will publish one.",
              },
              {
                type: "p",
                text: "What does exist is verified source. All twelve deployed contracts — three vaults, three oracles, three keeper guards, two basket adapters and the exit router — are source-verified on Blockscout, so the explorer shows the Solidity that produced the running bytecode instead of the bytecode alone. That means you can read exactly what every function does before sending anything.",
              },
              {
                type: "note",
                text: "Verified source is not an audit and does not substitute for one. It proves the published code is the code that runs. It says nothing about whether that code has a bug in it, and an unaudited contract can be perfectly verified and still lose your money.",
              },
            ],
          },
          {
            id: "before",
            title: "Before deposits open",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Full test coverage against forked mainnet state." },
                  { text: "An external audit, published in full including findings we did not fix." },
                  { text: "A deposit cap during the initial period." },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "risks",
        title: "Risks",
        intro: [
          "Ways you can lose money here. This list is written to be useful rather than reassuring.",
        ],
        sections: [
          {
            id: "list",
            title: "Known risks",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "Contract risk.",
                    text: "The code is unaudited. A bug in the vault, the adapters or the guard could lose funds outright.",
                  },
                  {
                    lead: "Oracle risk.",
                    text: "NAV and rebalancing depend on price feeds. A manipulated or wrong feed produces a wrong share price and bad trades.",
                  },
                  {
                    lead: "Lending market risk.",
                    text: "The yield leg inherits whatever the underlying money market is exposed to, including bad debt and utilisation spikes that delay withdrawals.",
                  },
                  {
                    lead: "Stock tokens are debt, not equity.",
                    text: "The stock tokens are tokenized debt securities. Holding one gives no voting rights, no shareholder rights and no claim on the underlying share — only exposure to its price, backed by the issuer.",
                  },
                  {
                    lead: "The issuer can freeze or destroy the position.",
                    text: "The token contracts expose pause, adminBurn and blockAccounts. The issuer can halt all transfers, burn tokens out of any holder including this vault, and block a specific address. Read on-chain, not inferred.",
                  },
                  {
                    lead: "Splits are applied by a multiplier.",
                    text: "A stock split changes a uiMultiplier on its own schedule, with no transaction from anyone here. The vault halts valuation until an operator confirms the change rather than risking a share price that is wrong by the split ratio.",
                  },
                  {
                    lead: "Liquidity risk.",
                    text: "Thin pools mean the exit price can be materially worse than the marked price, especially outside session hours.",
                  },
                  {
                    lead: "Stablecoin risk.",
                    text: "The base asset can depeg. The yield floor is only a floor while the floor holds.",
                  },
                  {
                    lead: "Keeper risk.",
                    text: "Bounded, not zero. A compromised keeper can still burn value inside the slippage and size caps.",
                  },
                  {
                    lead: "Regulatory risk.",
                    text: "Tokenized equities are not available in every jurisdiction, and the rules are moving. See Terms & eligibility.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    label: "REFERENCE",
    pages: [
      {
        slug: "architecture",
        title: "Architecture",
        intro: ["The contracts, what each one is for, and how they fit together."],
        sections: [
          {
            id: "contracts",
            title: "Components",
            blocks: [
              {
                type: "table",
                head: ["Contract", "Responsibility"],
                rows: [
                  ["Safex", "ERC-4626 core: shares, NAV, deposit, redeem, and the high-water-mark fee accounting"],
                  ["BasketAdapter", "Holds the equity basket and executes its trades"],
                  ["PriceOracle", "Prices holdings in USD and reports staleness"],
                  ["KeeperGuard", "Enforces every limit before a keeper action runs"],
                  ["ExitRouter", "Sells a whole position, equities included, to USDG in one transaction"],
                  ["BuybackModule", "Converts fee revenue into $SAFEX and burns what it buys"],
                ],
              },
              {
                type: "code",
                lines: [
                  "user --deposit--> Safex --+--> lending vault   (stablecoin leg)",
                  "                              |   external ERC-4626",
                  "                              +--> BasketAdapter   (equity leg)",
                  "                                        ^",
                  "keeper --> KeeperGuard ------------------+",
                  "",
                  "user --exit--> ExitRouter --> Safex.redeemInKind + v4 swaps --> USDG",
                ],
              },
              {
                type: "note",
                text: "There is no separate YieldAdapter or FeeController contract. The lending leg is an external ERC-4626 vault the Safex supplies into directly, and fee accounting lives inside Safex — fewer moving parts, and fewer contracts you have to read to know what happens to your money.",
              },
            ],
          },
          {
            id: "why-split",
            title: "Why it is split up",
            blocks: [
              {
                type: "p",
                text: "Adapters exist so the vault does not know or care which lending market or which venue it is using — swapping one out is a deployment, not a rewrite. The guard is separate so the rules governing automation can be read and reasoned about on their own, without picking them out of the vault's accounting logic.",
              },
            ],
          },
        ],
      },
      {
        slug: "contracts-and-chain",
        title: "Contracts & chain",
        intro: ["Addresses and network details. Verify before you sign anything."],
        sections: [
          {
            id: "addresses",
            title: "Deployed",
            blocks: [
              {
                type: "p",
                text: "Every address below is live on BNB Chain and source-verified on Blockscout — paste one into the explorer and you get the Solidity, not bytecode. These are the only SAFEX contracts that exist.",
              },
              {
                type: "table",
                head: ["Name", "Address"],
                rows: [
                  ["Safex · STEADY", "0xcd0898066b8345fE23b94Cf6Ea5Ffdd560a1ad37"],
                  ["Safex · BALANCED", "0x3601c09C4F84885454cCbd46B9dF3DaB244c1150"],
                  ["Safex · GROWTH", "0xa809DC62C6fc723E04B061cbE6271AaA093eC75b"],
                  ["KeeperGuard · STEADY", "0x101183e175EA27E059Fd44E6B36e5fBF1f466F26"],
                  ["KeeperGuard · BALANCED", "0x9a2aA7D2dd221aF99410215E5904146a7c96e1E7"],
                  ["KeeperGuard · GROWTH", "0x56CAceC02cc8DCb729b209cA1b8EdF5609da091B"],
                  ["PriceOracle · STEADY", "0xc5fF460259034d15AA0a149Bc035f4AF98a47139"],
                  ["PriceOracle · BALANCED", "0x6EEd6275c580C43A97825e9870397f96FA181ea8"],
                  ["PriceOracle · GROWTH", "0x7C3Ff9e01Dcb472D297648AbeDF5c1F595D3Deff"],
                  ["BasketAdapter · BALANCED", "0xA36f535E0035bb068cc27ca59137eF36b193f273"],
                  ["BasketAdapter · GROWTH", "0x76d58d2cF50BdB37e50117c5b7DfB6d579c7c609"],
                  ["ExitRouter", "0x2304d57bA6E5EecD3d4d8Cc657740D9aa5824035"],
                  ["$SAFEX", "%CA%"],
                  ["BuybackModule", "not deployed"],
                ],
              },
              {
                type: "note",
                text: "STEADY holds no equities, so it has no basket adapter by design. Its oracle is deployed for symmetry and prices nothing.",
              },
              {
                type: "note",
                text: "The $SAFEX address is published in this site's header. Check any address you are given against it, whoever is posting it, and never approve a contract you found in a direct message.",
              },
            ],
          },
          {
            id: "chain",
            title: "Network",
            blocks: [
              {
                type: "table",
                head: ["Field", "Value"],
                rows: [
                  ["Chain", "BNB Chain"],
                  ["Chain ID", "4663"],
                  ["RPC", "https://bsc-dataseed.binance.org"],
                  ["Explorer", "https://bscscan.com"],
                  ["Vault asset", "USDG"],
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "roadmap",
        title: "Roadmap",
        intro: [
          "What is built, what is being built, and what is deliberately still an idea.",
        ],
        sections: [
          {
            id: "now",
            title: "Now",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Vault terminal, strategy picker and wallet layer — live." },
                  { text: "All three vaults deployed on BNB Chain mainnet, with every contract source-verified." },
                  { text: "Deposits open, against real lending and real equity venues rather than mocks." },
                  { text: "Sell-everything exit through the router, in one transaction." },
                ],
              },
            ],
          },
          {
            id: "next",
            title: "Next",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "External audit, published in full including findings we did not fix." },
                  { text: "$SAFEX launch — the address will be published in the site header." },
                  { text: "Public keeper log, so rebalances can be read without an explorer." },
                  { text: "Auto-save scheduling." },
                ],
              },
            ],
          },
          {
            id: "later",
            title: "Later",
            blocks: [
              {
                type: "list",
                items: [
                  { text: "Custom splits instead of three fixed ones." },
                  { text: "Governance over guard parameters." },
                  { text: "Additional baskets beyond the current equity set." },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "faq",
        title: "FAQ",
        intro: ["Short answers. Longer versions live in the pages linked from each."],
        sections: [
          {
            id: "questions",
            title: "Common questions",
            blocks: [
              {
                type: "list",
                items: [
                  {
                    lead: "Can I lose money?",
                    text: "Yes. The equity leg can fall, the code is unaudited, and the base asset can depeg. See Risks.",
                  },
                  {
                    lead: "Is there a lockup?",
                    text: "No. Redemption is open every block and cannot be paused.",
                  },
                  {
                    lead: "Do I need $SAFEX to use the vaults?",
                    text: "No. It is entirely optional.",
                  },
                  {
                    lead: "Can I read the code that is actually running?",
                    text: "Yes. All twelve deployed contracts are source-verified on Blockscout, so the explorer shows Solidity rather than bytecode. Addresses are on Contracts & chain. That is not the same as an audit — see Audits.",
                  },
                  {
                    lead: "What is the yield?",
                    text: "Whatever the lending market pays, plus or minus whatever the basket does. No fixed rate is quoted because none can be honestly promised.",
                  },
                  {
                    lead: "Who can move my funds?",
                    text: "You. There is no admin path: the keeper cannot choose a destination, no holder can touch another's shares, and the basket adapter is fixed before the vault issues its first share. The owner can still cause pointless trading, which costs spread.",
                  },
                  {
                    lead: "What happens if SAFEX disappears?",
                    text: "The contracts keep running and redemption keeps working. It does not depend on the front end or on us being around.",
                  },
                  {
                    lead: "Why is my share count not going up?",
                    text: "It should not. Returns show up in the share price, not the balance. See Shares & NAV.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        slug: "terms",
        title: "Terms & eligibility",
        intro: [
          "SAFEX is software. Using it is your decision and your responsibility.",
        ],
        sections: [
          {
            id: "eligibility",
            title: "Eligibility",
            blocks: [
              {
                type: "p",
                text: "Tokenized equity products are not offered to US persons, and are restricted in a number of other jurisdictions. It is on you to know whether you may lawfully hold them where you live.",
              },
            ],
          },
          {
            id: "not-advice",
            title: "Not financial advice",
            blocks: [
              {
                type: "p",
                text: "Nothing in these docs is investment advice, and nothing here is a recommendation to buy or hold anything. There is no guaranteed return, no protected principal, and no insurance behind any of it.",
              },
              {
                type: "p",
                text: "The protocol is non-custodial, which cuts both ways: nobody can seize your position, and nobody can restore it either. There is no support desk that can reverse a transaction.",
              },
            ],
          },
        ],
      },
    ],
  },
];

export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap((g) => g.pages);

export function getDocPage(slug: string): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === slug);
}

/**
 * Resolve a page against the published $SAFEX address.
 *
 * Drops the blocks belonging to the other phase and substitutes the address
 * into whatever copy references it. Pure and synchronous -- the caller does
 * the one filesystem read, so this stays usable from anywhere.
 */
export function resolveDocPage(page: DocPage, safexToken: string | null): DocPage {
  const phase: DocPhase = safexToken ? "post-launch" : "pre-launch";
  /* Phase-neutral copy (the address table) still has to render something before
     the address is published, so the placeholder falls back rather than leaking
     "%CA%". A bare dash rather than a sentence: the docs state the token's
     status in exactly one place, the site header, and nowhere else. */
  const fill = (s: string) => s.split(CA_TOKEN).join(safexToken ?? "—");

  const block = (b: DocBlock): DocBlock => {
    switch (b.type) {
      case "p":
      case "note":
        return { ...b, text: fill(b.text) };
      case "list":
        return {
          ...b,
          items: b.items.map((i) => ({
            ...i,
            lead: i.lead ? fill(i.lead) : i.lead,
            text: fill(i.text),
          })),
        };
      case "table":
        return { ...b, rows: b.rows.map((r) => r.map(fill)) };
      case "code":
        return { ...b, lines: b.lines.map(fill) };
    }
  };

  return {
    ...page,
    intro: (page.introWhenLaunched && safexToken
      ? page.introWhenLaunched
      : page.intro
    ).map(fill),
    sections: page.sections.map((s) => ({
      ...s,
      blocks: s.blocks.filter((b) => !b.only || b.only === phase).map(block),
    })),
  };
}

export function getDocNeighbours(slug: string): {
  prev?: DocPage;
  next?: DocPage;
} {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  return { prev: DOC_PAGES[i - 1], next: DOC_PAGES[i + 1] };
}
