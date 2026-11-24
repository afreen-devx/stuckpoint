import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module, so it must be loaded by Node, not bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
