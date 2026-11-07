// Lectura y escritura del catálogo. Todo pasa por los esquemas compartidos con el sitio
// y por una cola, para que dos acciones seguidas no se pisen.
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ZodError, type ZodType } from "zod";
import {
  brandInputSchema,
  brandsSchema,
  catalogSchema,
  findMissingBrand,
  normalizeName,
  productInputSchema,
  siteSchema,
  type Brand,
  type Product,
  type ProductInput,
  type Site,
} from "../../src/lib/schema.ts";
import { UserError } from "./errors.ts";
import { imageExists, slugify } from "./images.ts";
import { migrateCategoriesToBrands, writeJsonAtomic } from "./migrate.ts";

/** Convierte un error de validación en el mensaje claro definido en el esquema. */
function parse<T>(schema: ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new UserError(error.issues[0]?.message ?? "Revisa los datos.");
    }
    throw error;
  }
}

/** Crea un id único a partir de un nombre: "nike", "nike-2", "nike-3"... */
function uniqueId(name: string, taken: string[], fallback: string) {
  const base = slugify(name) || fallback;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function createStore(root: string) {
  const productsPath = join(root, "content", "products.json");
  const brandsPath = join(root, "content", "brands.json");
  const sitePath = join(root, "content", "site.json");
  const imagesDir = join(root, "public", "products");

  let queue: Promise<unknown> = Promise.resolve();
  /** Ejecuta las operaciones de una en una, en orden de llegada. */
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(path, "utf8"));

  const readProducts = async (): Promise<Product[]> =>
    parse(catalogSchema, await readJson(productsPath));
  const readBrands = async (): Promise<Brand[]> => parse(brandsSchema, await readJson(brandsPath));
  const readSite = async (): Promise<Site> => parse(siteSchema, await readJson(sitePath));

  /** Revisa todo el contenido junto, como lo hará la compilación. */
  async function readAll() {
    const [products, brands, site] = await Promise.all([readProducts(), readBrands(), readSite()]);
    const missing = findMissingBrand(products, brands);
    if (missing) throw new UserError(`"${missing.name}" usa una marca que ya no existe. Elige otra.`);
    return { products, brands, site };
  }

  /** Antes de guardar un producto: sus fotos y su marca deben existir. */
  async function assertReferences(input: ProductInput) {
    for (const image of input.images) {
      if (!(await imageExists(image.id, imagesDir))) {
        throw new UserError("Una de las fotos ya no existe. Súbela de nuevo.");
      }
    }
    const brands = await readBrands();
    if (!brands.some((brand) => brand.id === input.brandId)) {
      throw new UserError("Esa marca ya no existe. Elige otra.");
    }
  }

  /** Dos marcas no pueden llamarse igual, aunque cambien mayúsculas o tildes. */
  function assertNameFree(name: string, brands: Brand[], exceptId?: string) {
    const clash = brands.find((b) => b.id !== exceptId && normalizeName(b.name) === normalizeName(name));
    if (clash) throw new UserError(`Ya existe la marca ${clash.name}.`);
  }

  return {
    imagesDir,
    serial,
    readProducts,
    readBrands,
    readSite,
    readAll,

    /** Convierte categorías antiguas en marcas. No hace nada si ya se migró. */
    migrate: () => serial(() => migrateCategoriesToBrands(root)),

    createProduct: (raw: unknown) =>
      serial(async () => {
        const input = parse(productInputSchema, raw);
        await assertReferences(input);
        const products = await readProducts();
        const id = uniqueId(input.name, products.map((p) => p.id), "producto");
        const product: Product = { id, ...input };
        await writeJsonAtomic(productsPath, [product, ...products]);
        return product;
      }),

    updateProduct: (id: string, raw: unknown) =>
      serial(async () => {
        const input = parse(productInputSchema, raw);
        await assertReferences(input);
        const products = await readProducts();
        const index = products.findIndex((product) => product.id === id);
        if (index < 0) throw new UserError("Ese producto ya no existe.", 404);
        const product: Product = { id, ...input };
        products[index] = product;
        await writeJsonAtomic(productsPath, products);
        return product;
      }),

    deleteProduct: (id: string) =>
      serial(async () => {
        const products = await readProducts();
        const remaining = products.filter((product) => product.id !== id);
        if (remaining.length === products.length) {
          throw new UserError("Ese producto ya no existe.", 404);
        }
        await writeJsonAtomic(productsPath, remaining);
      }),

    createBrand: (raw: unknown) =>
      serial(async () => {
        const input = parse(brandInputSchema, raw);
        const brands = await readBrands();
        assertNameFree(input.name, brands);
        const brand: Brand = { id: uniqueId(input.name, brands.map((b) => b.id), "marca"), ...input };
        await writeJsonAtomic(brandsPath, [...brands, brand]);
        return brand;
      }),

    /** Renombrar no cambia el id: los productos siguen apuntando a la misma marca. */
    updateBrand: (id: string, raw: unknown) =>
      serial(async () => {
        const input = parse(brandInputSchema, raw);
        const brands = await readBrands();
        const index = brands.findIndex((brand) => brand.id === id);
        if (index < 0) throw new UserError("Esa marca ya no existe.", 404);
        assertNameFree(input.name, brands, id);
        const brand: Brand = { id, ...input };
        brands[index] = brand;
        await writeJsonAtomic(brandsPath, brands);
        return brand;
      }),

    /** Una marca en uso no se puede eliminar: dejaría productos sin marca. */
    deleteBrand: (id: string) =>
      serial(async () => {
        const [brands, products] = await Promise.all([readBrands(), readProducts()]);
        const brand = brands.find((b) => b.id === id);
        if (!brand) throw new UserError("Esa marca ya no existe.", 404);
        const inUse = products.filter((product) => product.brandId === id).length;
        if (inUse > 0) {
          const count = inUse === 1 ? "1 producto" : `${inUse} productos`;
          throw new UserError(`${brand.name} tiene ${count}. Cámbialos de marca antes de eliminarla.`, 409);
        }
        await writeJsonAtomic(brandsPath, brands.filter((b) => b.id !== id));
      }),

    updateSite: (raw: unknown) =>
      serial(async () => {
        const site = parse(siteSchema, raw);
        await writeJsonAtomic(sitePath, site);
        return site;
      }),

    ensureImagesDir: () => mkdir(imagesDir, { recursive: true }),
  };
}

export type Store = ReturnType<typeof createStore>;
