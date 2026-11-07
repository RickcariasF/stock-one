import type { MetadataRoute } from "next";
import { getVisibleProducts, site } from "@/lib/catalog";
import { productUrl } from "@/lib/whatsapp";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site.url.replace(/\/+$/, "")}/` },
    ...getVisibleProducts().map((product) => ({ url: productUrl(product, site) })),
  ];
}
