import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

/**
 * Operator console. Not linked from anywhere on the site, and kept out of
 * search results -- obscurity is not the protection here (the password is),
 * but there is no reason for this page to be indexed either.
 */
export const metadata: Metadata = {
  title: "BLUR — admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="wire-title text-3xl text-wire-cyan glow-cyan tracking-widest">
          BLUR · ADMIN
        </h1>
        <p className="mt-2 mb-8 font-mono text-xs tracking-widest text-wire-muted">
          POST-LAUNCH SETTINGS
        </p>
        <AdminPanel />
      </div>
    </main>
  );
}
