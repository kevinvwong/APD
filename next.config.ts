import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the user-guide markdown is bundled into the /guide route's function
  // so reading it at runtime works on Vercel (avoids the search-index ENOENT
  // class of bug).
  outputFileTracingIncludes: {
    "/guide": ["./docs/USER_GUIDE.md"],
  },
};

export default nextConfig;
