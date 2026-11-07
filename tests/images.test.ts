import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { UserError } from "../editor/server/errors.ts";
import { removeUnusedImages, saveImage, slugify } from "../editor/server/images.ts";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "stock-one-images-"));
});
after(() => rm(dir, { recursive: true, force: true }));

const jpeg = (options: { exif?: boolean } = {}) => {
  const image = sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#d8cffa" } });
  if (options.exif) image.withExif({ IFD0: { Copyright: "SECRETO" } });
  return image.jpeg().toBuffer();
};

test("genera las dos variantes en WebP con un id propio", async () => {
  const image = await saveImage(await jpeg(), "Taza Azúl", dir);
  assert.match(image.id, /^taza-azul-[0-9a-f]{8}$/);
  const files = await readdir(dir);
  assert.ok(files.includes(`${image.id}-480.webp`) && files.includes(`${image.id}-1200.webp`));
  assert.deepEqual({ width: image.width, height: image.height }, { width: 1200, height: 600 });
});

test("el nombre recibido nunca se convierte en una ruta", async () => {
  const image = await saveImage(await jpeg(), "../../etc/passwd", dir);
  assert.match(image.id, /^etc-passwd-[0-9a-f]{8}$/);
});

test("elimina los metadatos de la foto", async () => {
  const original = await jpeg({ exif: true });
  assert.ok((await sharp(original).metadata()).exif);
  const image = await saveImage(original, "foto", dir);
  const meta = await sharp(join(dir, `${image.id}-480.webp`)).metadata();
  assert.equal(meta.exif, undefined);
});

test("rechaza SVG aunque sea una imagen válida", async () => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"><script>alert(1)</script></svg>`,
  );
  await assert.rejects(saveImage(svg, "x", dir), UserError);
});

test("rechaza contenido que no es imagen", async () => {
  await assert.rejects(saveImage(Buffer.from("<?php echo 1;"), "x", dir), UserError);
  await assert.rejects(saveImage(Buffer.alloc(0), "x", dir), UserError);
});

test("rechaza archivos demasiado grandes", async () => {
  await assert.rejects(saveImage(Buffer.alloc(11 * 1024 * 1024), "x", dir), /10 MB/);
});

test("slugify deja solo caracteres seguros", () => {
  assert.equal(slugify("  Café & Miel!! "), "cafe-miel");
  assert.equal(slugify("%%%"), "");
});

test("la limpieza conserva lo usado y lo que no creó el editor", async () => {
  const cleanDir = await mkdtemp(join(tmpdir(), "stock-one-clean-"));
  const used = await saveImage(await jpeg(), "usada", cleanDir);
  await saveImage(await jpeg(), "huerfana", cleanDir);
  await writeFile(join(cleanDir, "LEEME.txt"), "no tocar");
  const removed = await removeUnusedImages(new Set([used.id]), cleanDir);
  assert.equal(removed, 2);
  assert.deepEqual(
    (await readdir(cleanDir)).sort(),
    ["LEEME.txt", `${used.id}-1200.webp`, `${used.id}-480.webp`].sort(),
  );
  await rm(cleanDir, { recursive: true, force: true });
});
