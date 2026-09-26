import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

describe("security headers", () => {
  it("applies clickjacking, sniffing and referrer protection to every route", async () => {
    const rules = await nextConfig.headers!();
    const everyRoute = rules.find((rule) => rule.source === "/(.*)");
    const headers = Object.fromEntries(everyRoute!.headers.map(({ key, value }) => [key, value]));

    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(headers["Permissions-Policy"]).toContain("camera=(self)");
  });
});
