import assert from "node:assert/strict";
import { test } from "node:test";
import { brandsSchema, catalogSchema } from "../src/lib/schema.ts";
import { railBrands, visibleProducts } from "../src/lib/visibility.ts";

const base = { description: "x", priceCents: 100, images: [], featured: false, stock: 1 };
const products = catalogSchema.parse([
  { ...base, id: "a", name: "A", brandId: "numeris", status: "available" },
  { ...base, id: "b", name: "B", brandId: "numeris", status: "hidden" },
  { ...base, id: "c", name: "C", brandId: "nike", status: "available" },
  { ...base, id: "d", name: "D", brandId: "adidas", status: "available", featured: true },
]);
const brands = brandsSchema.parse([
  { id: "numeris", name: "NUMERIS" },
  { id: "nike", name: "Nike", comingSoon: true },
  { id: "adidas", name: "Adidas" },
  { id: "vans", name: "Vans", comingSoon: true },
  { id: "puma", name: "Puma" },
]);

test("oculta productos ocultos y los de marcas en Próximamente", () => {
  assert.deepEqual(visibleProducts(products, brands).map((p) => p.id), ["d", "a"]);
});

test("el filtro muestra marcas con productos y luego las de Próximamente", () => {
  const rail = railBrands(visibleProducts(products, brands), brands).map((b) => b.id);
  // Puma no tiene productos ni está en Próximamente: no aparece.
  assert.deepEqual(rail, ["adidas", "numeris", "nike", "vans"]);
});
