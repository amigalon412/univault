import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAddress, isAddress, type Address } from "viem";

/**
 * Settings the operator can change after launch without a rebuild.
 *
 * The $UNIVAULT contract address does not exist until the token is launched, and it
 * is needed on the site the minute it does. It used to live in
 * NEXT_PUBLIC_BLUR_TOKEN, which Next inlines into the client bundle at BUILD
 * time -- changing it meant editing .env, rebuilding, redeploying and
 * restarting the service, on the one day nobody has time for that. So it lives
 * in a JSON file that the running server reads, and an admin page writes.
 *
 * Server-only: this module touches the filesystem. Never import it from a
 * "use client" component -- go through /api/ca instead.
 */
export type SiteConfig = {
  /** Checksummed $UNIVAULT address, or null while the token does not exist. */
  univaultToken: Address | null;
  /** ISO timestamp of the last write, for the admin page to show. */
  updatedAt: string | null;
};

const EMPTY: SiteConfig = { univaultToken: null, updatedAt: null };

/**
 * Where the file lives. On a VPS this must point OUTSIDE the deploy directory
 * (e.g. /var/lib/blurvault) or the next redeploy wipes the address. The default
 * is only meant for local development.
 */
function configPath(): string {
  const dir = process.env.BLUR_DATA_DIR?.trim() || join(process.cwd(), ".data");
  return join(dir, "site-config.json");
}

/** Parse whatever is on disk, discarding anything that is not a real address. */
function coerce(raw: unknown): SiteConfig {
  if (typeof raw !== "object" || raw === null) return EMPTY;
  const record = raw as Record<string, unknown>;
  const token = record.univaultToken;
  const updatedAt = record.updatedAt;
  return {
    univaultToken:
      typeof token === "string" && isAddress(token) ? getAddress(token) : null,
    updatedAt: typeof updatedAt === "string" ? updatedAt : null,
  };
}

/**
 * The build-time value, kept as a fallback so a deploy that still sets the env
 * var keeps working exactly as before. The file wins once it has an address.
 */
function fromEnv(): Address | null {
  const raw = process.env.NEXT_PUBLIC_BLUR_TOKEN?.trim();
  return raw && isAddress(raw) ? getAddress(raw) : null;
}

export async function readSiteConfig(): Promise<SiteConfig> {
  try {
    const parsed = coerce(JSON.parse(await readFile(configPath(), "utf8")));
    return parsed.univaultToken ? parsed : { ...parsed, univaultToken: fromEnv() };
  } catch {
    // Missing or unreadable file is the normal state before the first write.
    return { ...EMPTY, univaultToken: fromEnv() };
  }
}

/**
 * Write the address. Rejects anything that is not a valid address, because a
 * typo here is published to every visitor as the official contract.
 *
 * `null` clears it and the site goes back to saying the token is not launched.
 */
export async function writeUnivaultToken(address: string | null): Promise<SiteConfig> {
  if (address !== null && !isAddress(address)) {
    throw new Error("not a valid address");
  }
  const next: SiteConfig = {
    univaultToken: address === null ? null : getAddress(address),
    updatedAt: new Date().toISOString(),
  };

  const target = configPath();
  await mkdir(dirname(target), { recursive: true });
  // Write-then-rename so a crash mid-write cannot leave a truncated file that
  // reads back as "no token" while the token is live.
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tmp, target);
  return next;
}
