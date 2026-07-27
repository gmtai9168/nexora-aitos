import type { MetadataRoute } from "next";

const BASE = "https://nexora-aitos.com";

/**
 * Sitemap of the public, crawlable pages so search engines can discover the
 * whole app from one file. Private routes (account/admin/api/onboarding) are
 * intentionally excluded — they're also disallowed in robots.ts.
 */
const PUBLIC_ROUTES = [
  "", // home — highest priority
  "/markets",
  "/market-intelligence",
  "/ai-network",
  "/portfolio",
  "/performance",
  "/strategies",
  "/backtest",
  "/ai-learning",
  "/risk",
  "/autonomous",
  "/executive",
  "/fund",
  "/war-room",
  "/history",
  "/alerts",
  "/login",
  "/signup",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
