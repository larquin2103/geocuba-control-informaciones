import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  output: "standalone",
  // Ensure critical server-side dependencies are included in standalone build
  // and not bundled by Turbopack (which can break native binaries like Prisma)
  serverExternalPackages: [
    "bcryptjs",
    "nodemailer",
    "jose",
    "prisma",
    "@prisma/client",
    ".prisma/client",
  ],
  allowedDevOrigins: [
    ".space-z.ai",
  ],
};

export default nextConfig;
