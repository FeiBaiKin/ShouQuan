import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出：产出 out/ 纯静态文件，交由 Go 后端 public/ 托管，部署模型不变
  output: "export",
  // 静态导出下必须禁用默认图片优化（无 Node 服务）
  images: { unoptimized: true },
  // 保持无尾斜杠，产物为 /buy.html /success.html 等，配合后端 try_files
  trailingSlash: false,
};

export default nextConfig;
