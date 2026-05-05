import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep heavy native/binary deps out of the server bundle so Next doesn't try
  // to trace and inline the Chromium binary or puppeteer-core internals.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Force Next.js to ship the brotli-compressed Chromium binary AND its
  // bundled shared libraries (libnss3.so, libatk, fonts, swiftshader) into
  // the Lambda for the PDF / quote API routes. Without this, the tracer
  // omits the .br files because they're loaded at runtime, not imported,
  // and the launched Chromium fails with "libnss3.so: cannot open ...".
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/quote/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
