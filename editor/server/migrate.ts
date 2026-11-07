// Migración de datos de versiones anteriores: convierte cada categoría en una marca.
// Es idempotente y no borra nada: si brands.json ya existe, no hace ningún cambio.
import { randomBytes } from "node:crypto";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeName } from "../../src/lib/schema.ts";
import { slugify } from "./images.ts";

type LegacyProduct = Record<string, unknown> & { category?: unknown; brandId?: unknown };

/** Escribe en un temporal y renombra: un corte de luz no deja el archivo a medias. */
export async function writeJsonAtomic(path: string, value: unknown) {
  const temp = `${path}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

/** Devuelve cuántas marcas creó, o `null` si no hacía falta migrar. */
export async function migrateCategoriesToBrands(root: string): Promise<number | null> {
  const brandsPath = join(root, "content", "brands.json");
  const productsPath = join(root, "content", "products.json");
  const exists = await access(brandsPath).then(
    () => true,
    () => false,
  );
  if (exists) return null;

  const products = JSON.parse(await readFile(productsPath, "utf8")) as LegacyProduct[];
  const brands: { id: string; name: string }[] = [];
  const byName = new Map<string, string>();

  for (const product of products) {
    if (typeof product.brandId === "string") continue;
    const name = typeof product.category === "string" && product.category.trim() ? product.category.trim() : "Sin marca";
    let id = byName.get(normalizeName(name));
    if (!id) {
      const base = slugify(name) || "marca";
      id = base;
      for (let n = 2; brands.some((brand) => brand.id === id); n += 1) id = `${base}-${n}`;
      brands.push({ id, name });
      byName.set(normalizeName(name), id);
    }
    product.brandId = id;
    delete product.category;
  }

  // Primero las marcas: si algo falla después, el catálogo original sigue intacto.
  await writeJsonAtomic(brandsPath, brands);
  await writeJsonAtomic(productsPath, products);
  return brands.length;
}
