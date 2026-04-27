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
  // Experimental: ensure Prisma works with Turbopack in dev mode
  experimental: {
    serverComponentsExternalPackages: [
      "bcryptjs",
      "nodemailer",
      "jose",
      "prisma",
      "@prisma/client",
      ".prisma/client",
    ],
  },
};

export default nextConfig;
