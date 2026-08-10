import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/admin-auth";
import { readSiteConfig, writeUnivaultToken } from "@/lib/site-config";

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
 * Publish (or clear) the $UNIVAULT address.
 *
 * Validation is not politeness here: whatever lands in this field is what the
 * header tells every visitor to copy. An address that fails the checksum is
 * rejected outright rather than saved and shown.
 */
export async function POST(request: Request) {
  if (!(await isAuthed())) return denied();

  let address: unknown;
  try {
    address = (await request.json())?.address;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const trimmed = typeof address === "string" ? address.trim() : "";
  try {
    const config = await writeUnivaultToken(trimmed === "" ? null : trimmed);
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(
      { error: "That is not a valid contract address." },
      { status: 400 },
    );
  }
}
