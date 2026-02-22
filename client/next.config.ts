import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@aztec/bb.js", "@noir-lang/noir_js"],
};

export default nextConfig;
