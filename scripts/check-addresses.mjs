/* Asserts that every hard-coded contract address in src/lib/chain.ts also
   appears in contracts/DEPLOYMENTS.md.

   This exists because of a specific near-miss: a launch video shipped three
   vault addresses taken from the "Superseded — do not use" section of that
   file, displayed under a green VERIFIED tick. Addresses that are wrong but
   look authoritative are the worst failure this codebase can ship, and they
   are invisible to typecheck, lint and eyeballs alike.

   Run: node scripts/check-addresses.mjs */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const chain = readFileSync("src/lib/chain.ts", "utf8");
const deployments = readFileSync("contracts/DEPLOYMENTS.md", "utf8").toLowerCase();

/* Only the addresses this project deployed, because DEPLOYMENTS.md is the
   record of what this team deployed and nothing else.

   Deliberately absent: USDG and STEAK_USDG are third-party contracts (Global
   Dollar, and Steakhouse's MetaMorpho vault), and Multicall3 is a canonical
   cross-chain address. There is no second source of truth to check any of them
   against, so listing them here would produce a permanent false alarm rather
   than catching anything. */
const CHECKED = [
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

/* The superseded vaults must never appear anywhere in shipped source -- the
   mistake this guards against was a dead address pasted into a component, not
   into this file. */
const SUPERSEDED = [
  "0xFd7223d33335c5A7bdFA44C8Fa0B212cA045A996",
  "0x066d4661A5419A68b64a0dCF51f5c295185dB175",
  "0xBF2b621E86e762C6f4C78aCAc4F1C41087CaB787",
];

const sources = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) sources.push(p);
  }
})("src");

for (const file of sources) {
  const text = readFileSync(file, "utf8").toLowerCase();
  for (const dead of SUPERSEDED) {
    if (text.includes(dead.toLowerCase())) {
      failures.push(`superseded vault ${dead} is referenced in ${file}`);
    }
  }
}

if (failures.length) {
  console.error("address check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`address check passed (${CHECKED.length} deployed constants, ${sources.length} source files scanned)`);
