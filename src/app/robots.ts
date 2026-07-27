import type { MetadataRoute } from "next";

const BASE = "https://nexora-aitos.com";

/**
 * robots.txt — lets search engines crawl the public app while keeping private
 * account/admin/API paths out of the index. Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api", "/onboarding"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
