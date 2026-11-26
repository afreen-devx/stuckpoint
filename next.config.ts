import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The question pack is read from packs/ at run time, so make sure it is shipped with every
  // server function when the app is deployed (on Vercel, for example).
  outputFileTracingIncludes: {
    "/": ["./packs/**/*"],
    "/**": ["./packs/**/*"],
  },
};

export default nextConfig;
