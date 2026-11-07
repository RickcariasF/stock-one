// Ejecuta la migración de categorías a marcas: pnpm migrate:brands
import { resolve } from "node:path";
import { migrateCategoriesToBrands } from "../editor/server/migrate.ts";

const created = await migrateCategoriesToBrands(resolve(import.meta.dirname, ".."));
console.log(
  created === null
    ? "El catálogo ya usa marcas. No hubo cambios."
    : `Migración lista: ${created} marcas creadas a partir de las categorías.`,
);
