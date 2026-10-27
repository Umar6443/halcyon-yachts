import type { NextConfig } from "next";

/**
 * Local dev / `next start` work as usual. For GitHub Pages the workflow sets GITHUB_PAGES=true,
 * which makes a fully static export, and NEXT_PUBLIC_BASE_PATH=/<repo-name> because project
 * sites are served from a sub-path. All media is referenced with relative paths, so it follows.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(process.env.GITHUB_PAGES ? { output: "export" as const, trailingSlash: true } : {}),
  ...(basePath ? { basePath } : {}),
  images: { unoptimized: true },
};

export default nextConfig;
