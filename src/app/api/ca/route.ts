import { NextResponse } from "next/server";
import { readSiteConfig } from "@/lib/site-config";

/**
 * The public read of the $UNIVAULT contract address.
 *
 * The header strip fetches this on mount rather than baking the address into
 * the bundle, so the operator can publish a CA from the admin page and every
 * page picks it up on the next load -- no rebuild, no redeploy, no restart.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { univaultToken } = await readSiteConfig();
  return NextResponse.json(
    { address: univaultToken },
    // The whole point is freshness on launch day. Nothing may cache this.
    { headers: { "cache-control": "no-store" } },
  );
}
