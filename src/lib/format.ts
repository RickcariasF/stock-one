import type { Site } from "./schema";

/** Convierte centavos en precio legible según la moneda de la tienda. */
export function formatPrice(priceCents: number, site: Pick<Site, "currency" | "locale">): string {
  const price = new Intl.NumberFormat(site.locale, {
    style: "currency",
    currency: site.currency,
  }).format(priceCents / 100);
  // Intl usa un espacio especial que se ve raro al copiar el mensaje de WhatsApp.
  return price.replace(/\u00a0/g, " ");
}
