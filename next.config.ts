import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // The test runner builds into its own directory so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Only the Docker production image uses the standalone bundle; `next start` locally does not.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    // Static assets under /public/media and files uploaded to MongoDB GridFS (served by /api/media).
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/api/media/**" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
