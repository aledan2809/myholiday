import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler disabled — causes prerender failures with Next.js 16
  // reactCompiler: true,

  // output: 'standalone', // disabled — causes prerender failures with React 19.2.x

  // Skip static generation for all pages — fixes Next.js 16 prerender useContext bug
  experimental: {
    staticGenerationRetryCount: 0,
  },
};

export default nextConfig;
