import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Note: "standalone" output removed - it's only needed for Docker/custom server deployments
  // The sandbox deployment system uses the standard build output
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
