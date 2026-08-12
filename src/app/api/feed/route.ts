import { NextResponse } from "next/server";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { safexAbi } from "@/lib/abis";
import {
  DEPLOYED_VAULTS,
  bnbChain,
  STEAK_USDG,
  STOCK_FEEDS,
} from "@/lib/chain";
import type { FeedItem, FeedResponse } from "@/types/feed";

export const dynamic = "force-dynamic";

const client = createPublicClient({
  chain: bnbChain,
  transport: http(),
});

const aggregatorAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const erc4626Abi = [
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const explorer = bnbChain.blockExplorers.default.url;

function short(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function usd(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Every visitor polls this, so without a cache each one would multiply into
 * chain reads. The window is short enough that the feed still moves.
 */
const CACHE_MS = 12_000;
let cached: { at: number; body: FeedResponse } | null = null;

async function readChain(): Promise<FeedResponse> {
  const vaultAddresses = DEPLOYED_VAULTS.map(([, address]) => address);

  const [block, results, vaultResults] = await Promise.all([
    client.getBlock(),
    client.multicall({
      contracts: [
        ...STOCK_FEEDS.map(({ feed }) => ({
          address: feed,
          abi: aggregatorAbi,
          functionName: "latestRoundData" as const,
        })),
        {
          address: STEAK_USDG,
          abi: erc4626Abi,
          functionName: "convertToAssets" as const,
          args: [10n ** 18n],
        },
        {
          address: STEAK_USDG,
          abi: erc4626Abi,
          functionName: "totalAssets" as const,
        },
      ],
    }),
    vaultAddresses.length > 0
      ? client.multicall({
          contracts: vaultAddresses.map((address) => ({
            address,
            abi: safexAbi,
            functionName: "totalAssets" as const,
          })),
        })
      : Promise.resolve([]),
  ]);

  // Readings without a timestamp of their own are stamped with the block they
  // were read at, which is a fact about the chain rather than about our clock.
  const at = Number(block.timestamp);
  const items: FeedItem[] = [];

  STOCK_FEEDS.forEach(({ symbol, feed }, i) => {
    const result = results[i];
    if (result.status !== "success") return;
    const [roundId, answer, , updatedAt] = result.result as readonly [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    if (answer <= 0n) return;

    items.push({
      id: `price:${symbol}:${roundId}`,
      kind: "price",
      subject: symbol,
      value: usd(Number(formatUnits(answer, 8))),
      detail: "chainlink",
      linkUrl: `${explorer}/address/${feed}`,
      linkShort: short(feed),
      ts: Number(updatedAt),
    });
  });

  const shareResult = results[STOCK_FEEDS.length];
  const suppliedResult = results[STOCK_FEEDS.length + 1];

  if (shareResult.status === "success") {
    const perShare = Number(formatUnits(shareResult.result as bigint, 6));
    const supplied =
      suppliedResult.status === "success"
        ? Number(formatUnits(suppliedResult.result as bigint, 6))
        : null;

    items.push({
      id: `yield:steakUSDG:${shareResult.result}`,
      kind: "yield",
      subject: "steakUSDG",
      value: `${perShare.toFixed(6)} USDG/share`,
      detail:
        supplied === null
          ? "lending venue"
          : `${usd(supplied, 0)} supplied · lending venue`,
      linkUrl: `${explorer}/address/${STEAK_USDG}`,
      linkShort: short(STEAK_USDG),
      ts: at,
    });
  }

  let tvlUsd: number | null = null;
  DEPLOYED_VAULTS.forEach(([id, address], i) => {
    const result = vaultResults[i];
    if (!result || result.status !== "success") return;
    const assets = Number(formatUnits(result.result as bigint, 6));
    tvlUsd = (tvlUsd ?? 0) + assets;
    items.push({
      id: `vault:${id}:${result.result}`,
      kind: "vault",
      subject: id.toUpperCase(),
      value: usd(assets, 0),
      detail: "vault holdings",
      linkUrl: `${explorer}/address/${address}`,
      linkShort: short(address),
      ts: at,
    });
  });

  items.sort((a, b) => b.ts - a.ts);

  return {
    items,
    stats: {
      blockNumber: Number(block.number),
      tvlUsd,
      vaultsDeployed: DEPLOYED_VAULTS.length,
    },
  };
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const body = await readChain();
    cached = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch {
    // Serve the last good read rather than an empty feed that would look like
    // the chain went quiet. If there is nothing cached, say so honestly.
    if (cached) return NextResponse.json(cached.body);
    return NextResponse.json(
      { items: [], stats: { blockNumber: 0, tvlUsd: null, vaultsDeployed: 0 } },
      { status: 503 },
    );
  }
}
