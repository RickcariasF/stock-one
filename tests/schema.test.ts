import assert from "node:assert/strict";
import { test } from "node:test";
import {
  brandsSchema,
  catalogSchema,
  findMissingBrand,
  isPlaceholderUrl,
  isSoldOut,
  productInputSchema,
  siteSchema,
} from "../src/lib/schema.ts";
import { parsePrice } from "../editor/ui/price.ts";

const input = {
  name: "Taza",
  description: "Taza de cerámica",
  priceCents: 25000,
  brandId: "nike",
  images: [],
  status: "available",
  featured: false,
};

const site = {
  name: "Stock One",
  tagline: "Bienvenida",
  url: "https://tienda.example",
  whatsappNumber: "50499990000",
  whatsappGreeting: "Hola",
  currency: "HNL",
  locale: "es-HN",
};

test("acepta un producto válido", () => {
  assert.equal(productInputSchema.safeParse(input).success, true);
});

test("rechaza precios negativos o con decimales sueltos", () => {
  assert.equal(productInputSchema.safeParse({ ...input, priceCents: -1 }).success, false);
  assert.equal(productInputSchema.safeParse({ ...input, priceCents: 10.5 }).success, false);
});

test("rechaza caracteres de control", () => {
  assert.equal(productInputSchema.safeParse({ ...input, name: "Ta\u0000za" }).success, false);
});

test("un id de imagen no puede salir de su carpeta", () => {
  const images = [{ id: "../../secreto", width: 10, height: 10 }];
  assert.equal(productInputSchema.safeParse({ ...input, images }).success, false);
});

test("rechaza ids repetidos", () => {
  const product = { ...input, id: "taza" };
  assert.equal(catalogSchema.safeParse([product, product]).success, false);
});

test("la dirección del sitio exige https y no admite credenciales", () => {
  for (const url of ["http://tienda.example", "javascript:alert(1)", "https://a:b@tienda.example"]) {
    assert.equal(siteSchema.safeParse({ ...site, url }).success, false, url);
  }
});

test("el número de WhatsApp solo admite dígitos", () => {
  for (const whatsappNumber of ["+50499990000", "504 9999 0000", "504999?text=x", "1234"]) {
    assert.equal(siteSchema.safeParse({ ...site, whatsappNumber }).success, false, whatsappNumber);
  }
});

test("un producto exige una marca válida", () => {
  assert.equal(productInputSchema.safeParse({ ...input, brandId: "" }).success, false);
  assert.equal(productInputSchema.safeParse({ ...input, brandId: "../x" }).success, false);
});

test("las marcas no se repiten aunque cambien mayúsculas o tildes", () => {
  const ok = [{ id: "nike", name: "Nike" }, { id: "adidas", name: "Adidas" }];
  assert.equal(brandsSchema.safeParse(ok).success, true);
  assert.equal(brandsSchema.safeParse([...ok, { id: "nike-2", name: " NIKE " }]).success, false);
});

test("detecta productos que apuntan a marcas inexistentes", () => {
  const brands = [{ id: "nike", name: "Nike" }];
  assert.equal(findMissingBrand([{ name: "A", brandId: "nike" }], brands), undefined);
  assert.equal(findMissingBrand([{ name: "B", brandId: "puma" }], brands)?.name, "B");
});

test("reconoce las direcciones de relleno", () => {
  assert.equal(isPlaceholderUrl("https://stock-one.example"), true);
  assert.equal(isPlaceholderUrl("https://stock-one.ricardo.workers.dev"), false);
});

test("existencias: enteras, no negativas y 1 por defecto en catálogos antiguos", () => {
  assert.equal(productInputSchema.parse(input).stock, 1);
  assert.equal(productInputSchema.safeParse({ ...input, stock: -1 }).success, false);
  assert.equal(productInputSchema.safeParse({ ...input, stock: 1.5 }).success, false);
});

test("sin existencias el producto se considera agotado", () => {
  assert.equal(isSoldOut({ status: "available", stock: 0 }), true);
  assert.equal(isSoldOut({ status: "sold_out", stock: 5 }), true);
  assert.equal(isSoldOut({ status: "available", stock: 1 }), false);
});

test("una marca sin el dato Próximamente queda disponible", () => {
  assert.equal(brandsSchema.parse([{ id: "nike", name: "Nike" }])[0]?.comingSoon, false);
});

test("interpreta el precio escrito por la persona", () => {
  assert.equal(parsePrice("1,250.50"), 125050);
  assert.equal(parsePrice("L 80"), 8000);
  assert.equal(parsePrice("19.99"), 1999);
  for (const value of ["", "abc", "-5", "1.234"]) assert.equal(parsePrice(value), null, value);
});
