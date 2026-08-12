import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import {
  readSiteConfig,
  writeStakingContract,
  writeSafexToken,
} from "@/lib/site-config";

export const dynamic = "force-dynamic";

const denied = () =>
  NextResponse.json({ error: "Not signed in." }, { status: 401 });

/** Current value, for the admin form to prefill. */
export async function GET() {
  if (!(await isAuthed())) return denied();
  const config = await readSiteConfig();
  return NextResponse.json(config);
}

/**
 * Publish (or clear) the $SAFEX address.
 *
 * Validation is not politeness here: whatever lands in this field is what the
 * header tells every visitor to copy. An address that fails the checksum is
 * rejected outright rather than saved and shown.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return denied();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  /* Two fields, one endpoint, and only the field that was sent is touched --
     so publishing the token cannot silently blank the staking address, or the
     other way round. */
  const field = "stakingContract" in body ? "stakingContract" : "address";
  const raw = body[field];
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  const value = trimmed === "" ? null : trimmed;

  try {
    const config =
      field === "stakingContract"
        ? await writeStakingContract(value)
        : await writeSafexToken(value);
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      { error: "That is not a valid contract address." },
      { status: 400 },
    );
  }
}
