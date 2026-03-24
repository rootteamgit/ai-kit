import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["fluent-ffmpeg"],
};

export default nextConfig;
