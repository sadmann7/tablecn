import type { MetadataRoute } from "next";

import { NAV_LINKS, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", ...NAV_LINKS.map(({ href }) => href)].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date().toISOString(),
  }));

  return [...routes];
}
