import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project, so Next.js does not get
  // confused by an unrelated lockfile higher up in the user's home folder.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
