// Punto único de lectura del contenido. Se ejecuta al compilar: si el JSON es inválido,
// la compilación falla y la versión publicada sigue intacta.
import brandsJson from "../../content/brands.json";
import productsJson from "../../content/products.json";
import siteJson from "../../content/site.json";
import { railBrands, visibleProducts } from "./visibility";
import {
  brandsSchema,
  catalogSchema,
  findMissingBrand,
  siteSchema,
  type Brand,
  type Product,
  type Site,
} from "./schema";

const brands = brandsSchema.parse(brandsJson);
const products = catalogSchema.parse(productsJson);
export const site: Site = siteSchema.parse(siteJson);

const missing = findMissingBrand(products, brands);
if (missing) {
  throw new Error(`El producto "${missing.name}" usa una marca que no existe (${missing.brandId}).`);
}

const brandById = new Map(brands.map((brand) => [brand.id, brand]));

/** Siempre existe: la validación de arriba garantiza que cada producto tiene su marca. */
export const getBrand = (id: string): Brand => brandById.get(id) as Brand;

/** Productos publicables: no ocultos y de marcas disponibles. Destacados primero. */
export const getVisibleProducts = (): Product[] => visibleProducts(products, brands);

export function getProduct(id: string): Product | undefined {
  return getVisibleProducts().find((product) => product.id === id);
}

/** Marcas del filtro: con productos visibles o marcadas como "Próximamente". */
export const getRailBrands = (list: Product[]): Brand[] => railBrands(list, brands);
