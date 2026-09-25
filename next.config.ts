import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project, so Next.js does not get
  // confused by an unrelated lockfile higher up in the user's home folder.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Development machines here have little memory to spare, and Next.js
    // failed repeatedly with "Jest worker encountered 2 child process
    // exceptions" when its compile workers could not get any. One worker,
    // and webpack's lower memory mode, trade some compile speed for
    // staying up.
    cpus: 1,
    webpackMemoryOptimizations: true,
    serverActions: {
      // The default 1mb body limit is too small for a CSV of up to five
      // thousand member rows uploaded through a Server Action.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
