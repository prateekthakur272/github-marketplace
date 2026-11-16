// Static export so it can be hosted on GitHub Pages. Data is fetched live in
// the browser (same as the Flutter app).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};
