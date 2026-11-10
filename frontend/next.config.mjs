// Next.js configuration for the FitTrack web app.
// The UI is a Next.js App Router app (src/app); data comes from the Express API in ../backend.
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Hide the floating Next.js dev badge: it sits over the sidebar's profile avatar.
    devIndicators: false,
    // The app lives inside a repo that also has backend/ and simulator/ with their own lockfiles:
    // pin the workspace root to this folder so Next doesn't guess a parent directory.
    turbopack: { root: import.meta.dirname },
    outputFileTracingRoot: import.meta.dirname
};

export default nextConfig;
