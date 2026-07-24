import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server at `.next/standalone` that bundles only the
  // runtime files actually reached — a fraction of node_modules. Lets a small
  // VPS run the app from ~100 MB without keeping the full 670 MB node_modules,
  // and lets you build off-server and ship just the bundle. See HOSTING.md.
  output: "standalone",
};

export default nextConfig;
