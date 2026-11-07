// Enlaces de pedido. wa.me acepta texto prellenado sin usar la API de WhatsApp:
// el cliente revisa el mensaje y lo envía desde su propia cuenta.
import { formatPrice } from "./format";
import { normalizeName, type Brand, type Product, type Site } from "./schema";

/** Dirección pública de un producto; se incluye en el mensaje para el vendedor. */
export function productUrl(product: Pick<Product, "id">, site: Pick<Site, "url">): string {
  return `${site.url.replace(/\/+$/, "")}/producto/${product.id}/`;
}

/** "Air Max 90" con marca Nike → "Nike Air Max 90". No repite la marca si ya está en el nombre. */
export function fullName(product: Pick<Product, "name">, brand: Pick<Brand, "name">): string {
  const name = normalizeName(product.name);
  const brandName = normalizeName(brand.name);
  return name === brandName || name.startsWith(`${brandName} `)
    ? product.name
    : `${brand.name} ${product.name}`;
}

/** Mensaje que llega al vendedor: saludo, marca y modelo, precio y enlace. */
export function productMessage(product: Product, brand: Brand, site: Site): string {
  const price = formatPrice(product.priceCents, site);
  return [site.whatsappGreeting, `${fullName(product, brand)} (${price})`, productUrl(product, site)].join("\n");
}

/** `encodeURIComponent` protege saltos de línea, tildes y símbolos como & o #. */
export function whatsappUrl(site: Pick<Site, "whatsappNumber">, message?: string): string {
  const base = `https://wa.me/${site.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
