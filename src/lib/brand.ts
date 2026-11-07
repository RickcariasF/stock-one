// Logotipo de Stock One. Los originales están en brand/; aquí se usan las versiones recortadas.
import { existsSync } from "node:fs";
import { join } from "node:path";

const LOGOS = {
  /** Texto negro: para fondos claros. */
  onLight: "/brand/logo.png",
  /** Texto blanco: para fondos oscuros, como la barra y la portada. */
  onDark: "/brand/logo-white.png",
} as const;

/** Medidas reales del PNG recortado; evitan saltos de diseño mientras carga. */
export const LOGO_SIZE = { width: 640, height: 859 } as const;

/** Devuelve la ruta del logo si existe; sin archivo, el sitio muestra el nombre como texto. */
export function getLogo(variant: keyof typeof LOGOS = "onDark"): string | null {
  const path = LOGOS[variant];
  return existsSync(join(process.cwd(), "public", path)) ? path : null;
}
