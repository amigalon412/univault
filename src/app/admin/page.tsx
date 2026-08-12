import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

/**
 * Operator console. Not linked from anywhere on the site, and kept out of
 * search results -- obscurity is not the protection here (the password is),
 * but there is no reason for this page to be indexed either.
 */
export const metadata: Metadata = {
  title: "SAFEX — admin",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminPage() {
  return (
    <main className="admin-shell page-enter">
      <div className="admin-card card">
        <span className="eyebrow">{"// Operator"}</span>
        <h1>SAFEX admin</h1>
        <p>Post-launch settings.</p>
        <AdminPanel />
      </div>
    </main>
  );
}
