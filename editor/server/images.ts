// Procesa las fotos subidas. Volver a codificarlas elimina metadatos (como la ubicación GPS)
// y cualquier contenido escondido: al sitio solo llegan archivos WebP creados aquí.
import { randomBytes } from "node:crypto";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { IMAGE_WIDTHS, type ProductImage } from "../../src/lib/schema.ts";
import { UserError } from "./errors.ts";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// El formato se detecta por el contenido real; la extensión no es confiable. SVG queda
// fuera a propósito porque puede contener scripts.
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
// Evita que una imagen pequeña en bytes consuma toda la memoria al descomprimirse.
const MAX_INPUT_PIXELS = 50_000_000;

/** "Taza azul!" → "taza-azul". Solo deja caracteres seguros para rutas y direcciones web. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

const filePath = (dir: string, id: string, width: number) => join(dir, `${id}-${width}.webp`);

/** Valida la foto y genera sus variantes. El id se crea aquí, nunca desde el nombre recibido. */
export async function saveImage(data: Buffer, label: string, dir: string): Promise<ProductImage> {
  if (data.length === 0) throw new UserError("La foto está vacía.");
  if (data.length > MAX_UPLOAD_BYTES) throw new UserError("La foto pesa más de 10 MB.");

  const open = () => sharp(data, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS });

  let format: string | undefined;
  try {
    format = (await open().metadata()).format;
  } catch {
    throw new UserError("Ese archivo no se puede leer. Usa una foto JPG, PNG o WebP.");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new UserError("Usa una foto JPG, PNG o WebP.");
  }

  const id = `${slugify(label) || "foto"}-${randomBytes(4).toString("hex")}`;
  let result = { width: 0, height: 0 };
  for (const width of IMAGE_WIDTHS) {
    const info = await open()
      .autoOrient()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filePath(dir, id, width));
    result = { width: info.width, height: info.height };
  }
  return { id, ...result };
}

export async function imageExists(id: string, dir: string): Promise<boolean> {
  const checks = IMAGE_WIDTHS.map((width) =>
    stat(filePath(dir, id, width)).then(
      () => true,
      () => false,
    ),
  );
  return (await Promise.all(checks)).every(Boolean);
}

/** Borra las fotos que ya ningún producto usa. Solo toca archivos con el patrón del editor. */
export async function removeUnusedImages(usedIds: Set<string>, dir: string): Promise<number> {
  const pattern = new RegExp(`^(.+)-(?:${IMAGE_WIDTHS.join("|")})\\.webp$`);
  const names = await readdir(dir);
  let removed = 0;
  for (const name of names) {
    const id = pattern.exec(name)?.[1];
    if (id && !usedIds.has(id)) {
      await rm(join(dir, name));
      removed += 1;
    }
  }
  return removed;
}
