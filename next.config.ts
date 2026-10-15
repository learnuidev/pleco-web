import type { NextConfig } from "next";

/**
 * `hanzi` ships ~15 MB of CommonJS data files that its `start()` compiles into
 * in-memory dictionaries. Two things matter:
 *
 *  1. It must be external, so Next loads it from node_modules instead of trying
 *     to bundle a 15 MB module graph into every route.
 *  2. It must resolve to a *single* runtime module instance. Route handlers are
 *     separate module graphs, so without this each route would compile its own
 *     copy of the dictionaries (~1 s and ~100 MB each, first hit only).
 *
 * The alias pins the package to one absolute path for the bundler, and
 * `src/lib/hanzi.ts` additionally caches the compiled instance on `globalThis`.
 */
const hanziEntry = require.resolve("hanzi");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: ".next",
  // The dev server is reached as 127.0.0.1 by tooling and localhost by people;
  // both need to be trusted or Next blocks its own HMR/asset requests.
  allowedDevOrigins: ["127.0.0.1", "localhost", "[::1]"],
  serverExternalPackages: ["hanzi"],
  turbopack: {
    root: __dirname,
    resolveAlias: {
      hanzi: hanziEntry,
    },
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/stroke-data/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
