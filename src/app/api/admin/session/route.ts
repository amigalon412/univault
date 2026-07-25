import { NextResponse } from "next/server";
import {
  adminPassword,
  checkPassword,
  clearFailures,
  clientKey,
  endSession,
  isAuthed,
  isThrottled,
  noteFailure,
  startSession,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Is there a live session? The admin page asks before drawing a form. */
export async function GET() {
  if (!adminPassword()) {
    return NextResponse.json({ enabled: false, authed: false }, { status: 503 });
  }
  return NextResponse.json({ enabled: true, authed: await isAuthed() });
}

/** Log in. */
export async function POST(request: Request) {
  if (!adminPassword()) {
    return NextResponse.json(
      { error: "Admin is disabled: ADMIN_PASSWORD is not set on the server." },
      { status: 503 },
    );
  }

  const key = clientKey(request);
  if (isThrottled(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait 15 minutes." },
      { status: 429 },
    );
  }

  let password: unknown;
  try {
    password = (await request.json())?.password;
  } catch {
    password = undefined;
  }

  if (!checkPassword(password)) {
    noteFailure(key);
    // One message for every failure mode, so a wrong password cannot be told
    // apart from a malformed request.
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  clearFailures(key);
  await startSession();
  return NextResponse.json({ ok: true });
}

/** Log out. */
export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
