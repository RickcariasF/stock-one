import assert from "node:assert/strict";
import { test } from "node:test";
import { formatPrice } from "../src/lib/format.ts";
import type { Brand, Product, Site } from "../src/lib/schema.ts";
import { fullName, productMessage, productUrl, whatsappUrl } from "../src/lib/whatsapp.ts";

const site: Site = {
  name: "Stock One",
  tagline: "Bienvenida",
  url: "https://tienda.example/",
  whatsappNumber: "50499990000",
  whatsappGreeting: "Hola, me interesa este par:",
  currency: "HNL",
  locale: "es-HN",
};

const brand: Brand = { id: "new-balance", name: "New Balance", comingSoon: false };

const product: Product = {
  id: "runner-990",
  name: "Runner & Co #1",
  description: "Descripción",
  priceCents: 125050,
  brandId: "new-balance",
  images: [],
  status: "available",
  featured: false,
  stock: 1,
};

test("el precio se muestra a partir de centavos", () => {
  assert.equal(formatPrice(125050, site), "L 1,250.50");
});

test("la dirección del producto no duplica barras", () => {
  assert.equal(productUrl(product, site), "https://tienda.example/producto/runner-990/");
});

test("el nombre completo antepone la marca sin repetirla", () => {
  assert.equal(fullName(product, brand), "New Balance Runner & Co #1");
  assert.equal(fullName({ name: "new balance 990" }, brand), "new balance 990");
  // "Nikea" no empieza por la marca Nike aunque comparta letras.
  assert.equal(fullName({ name: "Nikea" }, { name: "Nike" }), "Nike Nikea");
});

test("el mensaje incluye marca, modelo, precio y enlace", () => {
  const message = productMessage(product, brand, site);
  assert.match(message, /New Balance Runner & Co #1 \(L 1,250\.50\)/);
  assert.match(message, /https:\/\/tienda\.example\/producto\/runner-990\//);
});

test("el enlace codifica símbolos que romperían la dirección", () => {
  const message = productMessage(product, brand, site);
  const url = new URL(whatsappUrl(site, message));
  assert.equal(url.origin + url.pathname, "https://wa.me/50499990000");
  // Decodificado debe ser idéntico al mensaje: & y # no cortan el texto.
  assert.equal(url.searchParams.get("text"), message);
  assert.equal([...url.searchParams.keys()].length, 1);
});
