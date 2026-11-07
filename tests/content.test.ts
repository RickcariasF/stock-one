// Esta prueba corre en CI: impide desplegar un catálogo que apunte a fotos inexistentes.
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";
import { brandsSchema, catalogSchema, findMissingBrand, IMAGE_WIDTHS, siteSchema } from "../src/lib/schema.ts";

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

test("el contenido cumple el esquema", async () => {
  catalogSchema.parse(await readJson("content/products.json"));
  brandsSchema.parse(await readJson("content/brands.json"));
  siteSchema.parse(await readJson("content/site.json"));
});

test("cada producto apunta a una marca existente", async () => {
  const products = catalogSchema.parse(await readJson("content/products.json"));
  const brands = brandsSchema.parse(await readJson("content/brands.json"));
  assert.equal(findMissingBrand(products, brands), undefined);
});

test("todas las fotos existen", async () => {
  const products = catalogSchema.parse(await readJson("content/products.json"));
  for (const { images } of products) {
    for (const { id } of images) {
      for (const width of IMAGE_WIDTHS) await stat(`public/products/${id}-${width}.webp`);
    }
  }
  assert.ok(true);
});
