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
    "192.168.7.166",
    "192.168.7.0/24",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
