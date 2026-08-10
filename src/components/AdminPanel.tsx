"use client";

import { useCallback, useEffect, useState } from "react";

type Status = { kind: "idle" | "ok" | "error"; text: string };

const IDLE: Status = { kind: "idle", text: "" };

const field = "field";
const button = "btn btn-ghost btn-compact";

/**
 * The one thing the operator has to do on launch day: paste the $UNIVAULT contract
 * address and press publish. It lands in a file the server reads on every
 * request, so the header strip shows it site-wide without a rebuild.
 */
export function AdminPanel() {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(IDLE);

  const loadAddress = useCallback(async () => {
    const res = await fetch("/api/admin/ca", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAddress(data.univaultToken ?? "");
    setSavedAt(data.updatedAt ?? null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        const data = await res.json();
        setEnabled(Boolean(data.enabled));
        setAuthed(Boolean(data.authed));
        if (data.authed) await loadAddress();
      } catch {
        setEnabled(false);
      } finally {
        setReady(true);
      }
    })();
  }, [loadAddress]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(IDLE);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setStatus({ kind: "error", text: (await res.json()).error ?? "Failed." });
        return;
      }
      setPassword("");
      setAuthed(true);
      await loadAddress();
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setAddress("");
    setStatus(IDLE);
  };

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus(IDLE);
    try {
      const res = await fetch("/api/admin/ca", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", text: data.error ?? "Failed." });
        return;
      }
      setAddress(data.univaultToken ?? "");
      setSavedAt(data.updatedAt ?? null);
      setStatus({
        kind: "ok",
        text: data.univaultToken
          ? "Published. The CA bar shows it on every page from the next load."
          : "Cleared. The site is back to saying the token is not launched.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <p className="form-foot">Loading…</p>;
  }

  if (!enabled) {
    return (
      <div className="notice">
        <p>
          Admin is switched off because <code>ADMIN_PASSWORD</code>{" "}
          is not set on the server (it must be at least 12 characters). Set it in
          the service environment and restart.
        </p>
      </div>
    );
  }

  if (!authed) {
    return (
      <form onSubmit={signIn} className="flex flex-col gap-3">
        <label className="ui-label">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className={field}
        />
        <button type="submit" disabled={busy || !password} className={button}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        {status.kind === "error" && (
          <p className="form-error">{status.text}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={publish} className="flex flex-col gap-3">
      <label className="ui-label">$UNIVAULT contract address</label>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        className={field}
      />
      <p className="form-foot form-foot-left">
        Leave empty and publish to clear it — the header goes back to warning
        that any address claiming to be $UNIVAULT is fake.
      </p>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Saving…" : "Publish"}
        </button>
        <button type="button" onClick={signOut} className={button}>
          Sign out
        </button>
      </div>

      {status.kind !== "idle" && (
        <p
          className={status.kind === "ok" ? "form-ok" : "form-error"}
        >
          {status.text}
        </p>
      )}
      {savedAt && (
        <p className="form-foot form-foot-left">
          Last change: {new Date(savedAt).toUTCString()}
        </p>
      )}
    </form>
  );
}
