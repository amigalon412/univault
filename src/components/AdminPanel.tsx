"use client";

import { useCallback, useEffect, useState } from "react";

type Status = { kind: "idle" | "ok" | "error"; text: string };

const IDLE: Status = { kind: "idle", text: "" };

const field =
  "w-full bg-black border border-wire-border px-3 py-2 font-mono text-sm text-wire-cyan outline-none focus:border-wire-cyan";
const button =
  "border border-wire-cyan text-wire-cyan font-mono text-xs tracking-widest px-4 py-2 hover:bg-wire-cyan hover:text-black disabled:opacity-30 transition-all";

/**
 * The one thing the operator has to do on launch day: paste the $BLUR contract
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
    setAddress(data.blurToken ?? "");
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
      setAddress(data.blurToken ?? "");
      setSavedAt(data.updatedAt ?? null);
      setStatus({
        kind: "ok",
        text: data.blurToken
          ? "Published. The CA bar shows it on every page from the next load."
          : "Cleared. The site is back to saying the token is not launched.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return <p className="font-mono text-xs text-wire-muted">LOADING…</p>;
  }

  if (!enabled) {
    return (
      <div className="border border-wire-border p-4">
        <p className="font-mono text-xs text-wire-muted leading-relaxed">
          Admin is switched off because <code className="text-wire-cyan">ADMIN_PASSWORD</code>{" "}
          is not set on the server (it must be at least 12 characters). Set it in
          the service environment and restart.
        </p>
      </div>
    );
  }

  if (!authed) {
    return (
      <form onSubmit={signIn} className="flex flex-col gap-3">
        <label className="font-mono text-[11px] tracking-widest text-wire-muted">
          PASSWORD
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className={field}
        />
        <button type="submit" disabled={busy || !password} className={button}>
          {busy ? "CHECKING…" : "SIGN IN"}
        </button>
        {status.kind === "error" && (
          <p className="font-mono text-xs text-wire-purple">{status.text}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={publish} className="flex flex-col gap-3">
      <label className="font-mono text-[11px] tracking-widest text-wire-muted">
        $BLUR CONTRACT ADDRESS
      </label>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        className={field}
      />
      <p className="font-mono text-[11px] text-wire-muted leading-relaxed">
        Leave empty and publish to clear it — the header goes back to warning
        that any address claiming to be $BLUR is fake.
      </p>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className={button}>
          {busy ? "SAVING…" : "PUBLISH"}
        </button>
        <button type="button" onClick={signOut} className={button}>
          SIGN OUT
        </button>
      </div>

      {status.kind !== "idle" && (
        <p
          className={`font-mono text-xs ${
            status.kind === "ok" ? "text-wire-cyan" : "text-wire-purple"
          }`}
        >
          {status.text}
        </p>
      )}
      {savedAt && (
        <p className="font-mono text-[11px] text-wire-muted">
          Last change: {new Date(savedAt).toUTCString()}
        </p>
      )}
    </form>
  );
}
