// Catálogos creados antes de las marcas: sus categorías se convierten sin perder datos.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { migrateCategoriesToBrands } from "../editor/server/migrate.ts";
import { brandsSchema, catalogSchema, findMissingBrand } from "../src/lib/schema.ts";

const root = mkdtempSync(join(tmpdir(), "stock-one-migrate-"));
after(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, "content"));

const legacy = (id: string, category: string) => ({
  id,
  name: id,
  description: "x",
  priceCents: 100,
  category,
  images: [],
  status: "available",
  featured: false,
});

writeFileSync(
  join(root, "content", "products.json"),
  JSON.stringify([legacy("a", "Nike"), legacy("b", "nike "), legacy("c", "Adidas")]),
);

const read = (name: string) => JSON.parse(readFileSync(join(root, "content", name), "utf8"));

test("convierte categorías en marcas y une las equivalentes", async () => {
  assert.equal(await migrateCategoriesToBrands(root), 2);
  const brands = brandsSchema.parse(read("brands.json"));
  const products = catalogSchema.parse(read("products.json"));
  assert.deepEqual(brands, [
    { id: "nike", name: "Nike", comingSoon: false },
    { id: "adidas", name: "Adidas", comingSoon: false },
  ]);
  assert.deepEqual(products.map((p) => p.brandId), ["nike", "nike", "adidas"]);
  assert.equal(findMissingBrand(products, brands), undefined);
  assert.equal("category" in (read("products.json")[0] as object), false);
});

test("es idempotente: una segunda ejecución no cambia nada", async () => {
  const before = readFileSync(join(root, "content", "products.json"), "utf8");
  assert.equal(await migrateCategoriesToBrands(root), null);
  assert.equal(readFileSync(join(root, "content", "products.json"), "utf8"), before);
});
