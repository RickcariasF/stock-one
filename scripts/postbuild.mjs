// Se ejecuta después de `next build`. Hace dos cosas sobre la carpeta `out/`:
//  1. Añade a cada página una política CSP con la huella de sus scripts en línea.
//  2. Escribe version.json, que el editor consulta para confirmar que el sitio ya cambió.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = "out";
// Next.js incrusta scripts en línea para hidratar React. Permitir solo sus huellas
// exactas bloquea cualquier otro script inyectado, sin usar 'unsafe-inline' efectivo.
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
const CHARSET = /<meta charSet="utf-8"\/>/i;

const hash = (code) => `'sha256-${createHash("sha256").update(code, "utf8").digest("base64")}'`;

async function addCsp(file) {
  const html = await readFile(file, "utf8");
  const hashes = new Set();
  for (const [, attributes, code] of html.matchAll(INLINE_SCRIPT)) {
    // Los bloques de datos (JSON-LD) no se ejecutan, así que no necesitan permiso.
    if (code && !attributes.includes("application/ld+json")) hashes.add(hash(code));
  }
  if (!CHARSET.test(html)) throw new Error(`No encontré la etiqueta charset en ${file}`);
  const policy = `script-src 'self' ${[...hashes].join(" ")}`;
  // Va al inicio del head porque el navegador solo la aplica a lo que aparece después.
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;
  await writeFile(file, html.replace(CHARSET, (tag) => tag + meta));
  return hashes.size;
}

const entries = await readdir(OUT, { recursive: true });
const pages = entries.filter((name) => name.endsWith(".html"));
let total = 0;
for (const page of pages) total += await addCsp(join(OUT, page));

await writeFile(
  join(OUT, "version.json"),
  JSON.stringify({ sha: process.env.GITHUB_SHA ?? "local" }),
);

console.log(`CSP aplicada a ${pages.length} páginas (${total} scripts en línea).`);
