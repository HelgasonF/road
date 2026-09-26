import type { NextConfig } from "next";

// Script and style sources are not restricted yet: that needs per-request
// nonces. These directives still block framing, plugins and base/form hijacks.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Android devices connected through ADB reach the local dev server through
  // the phone's loopback address. Allow that origin to load Next.js dev assets.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
