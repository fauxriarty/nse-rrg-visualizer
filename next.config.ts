import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Keep native ONNX runtime external and include its binary payload in serverless output.
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/market-data": ["./node_modules/onnxruntime-node/bin/**/*"],
  },
};

export default nextConfig;
