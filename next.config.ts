import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Keep native ONNX runtime external and include only Linux x64 binary used by Vercel Node runtime.
  serverExternalPackages: ["onnxruntime-node"],
  outputFileTracingIncludes: {
    "/api/market-data": [
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/api/market-data": [
      "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/win32/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
      "./node_modules/onnxruntime-web/dist/**/*",
      "./node_modules/onnxruntime-web/lib/**/*",
    ],
  },
};

export default nextConfig;
