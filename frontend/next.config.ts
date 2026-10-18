import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the production Docker image small — only the files a request
  // actually needs get copied into the final stage, not the full
  // node_modules tree.
  output: "standalone",
  async redirects() {
    // No public marketing site — the root domain goes straight into the product.
    return [{ source: "/", destination: "/login", permanent: false }];
  },
};

export default nextConfig;
