import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the production Docker image small — only the files a request
  // actually needs get copied into the final stage, not the full
  // node_modules tree.
  output: "standalone",
};

export default nextConfig;
