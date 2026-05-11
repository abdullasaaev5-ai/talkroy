const staticExport = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
