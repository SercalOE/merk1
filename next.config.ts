import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // exceljs usa módulos de Node: se carga con require nativo en el servidor.
  serverExternalPackages: ["exceljs"],
  experimental: {
    // El Excel del plan sube por Server Action (por defecto 1 MB). La acción rechaza > 4 MB.
    serverActions: { bodySizeLimit: "5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
