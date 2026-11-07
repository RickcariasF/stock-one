// Qué muestra la tienda. Funciones puras para poder probarlas sin compilar el sitio.
import type { Brand, Product } from "./schema";

/** Productos publicables: no ocultos y de marcas disponibles. Destacados primero. */
export function visibleProducts(products: Product[], brands: Brand[]): Product[] {
  const soon = new Set(brands.filter((b) => b.comingSoon).map((b) => b.id));
  const visible = products.filter((p) => p.status !== "hidden" && !soon.has(p.brandId));
  return [...visible.filter((p) => p.featured), ...visible.filter((p) => !p.featured)];
}

/** Marcas del filtro: primero las que tienen productos, luego las de "Próximamente". */
export function railBrands(visible: Product[], brands: Brand[]): Brand[] {
  const used = new Set(visible.map((p) => p.brandId));
  const byName = (a: Brand, b: Brand) => a.name.localeCompare(b.name, "es");
  return [
    ...brands.filter((b) => !b.comingSoon && used.has(b.id)).sort(byName),
    ...brands.filter((b) => b.comingSoon).sort(byName),
  ];
}
