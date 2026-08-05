import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

/**
 * Operator console. Not linked from anywhere on the site, and kept out of
 * search results -- obscurity is not the protection here (the password is),
 * but there is no reason for this page to be indexed either.
 */
export const metadata: Metadata = {
  title: "UNIVAULT — admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return (
    <main className="relative z-10 min-h-screen px-6 py-16">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="wire-title text-3xl text-white">UNIVAULT · Admin</h1>
        <p className="mt-2 mb-8 text-sm text-wire-muted">Post-launch settings</p>
        <AdminPanel />
      </div>
    </main>
  );
}
