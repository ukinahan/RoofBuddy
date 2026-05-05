import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep heavy native/binary deps out of the server bundle so Next doesn't try
  // to trace and inline the Chromium binary or puppeteer-core internals.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
};

export default nextConfig;
