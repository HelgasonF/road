import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Android devices connected through ADB reach the local dev server through
  // the phone's loopback address. Allow that origin to load Next.js dev assets.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
