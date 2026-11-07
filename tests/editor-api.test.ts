// Prueba la API del editor como la vería un atacante y como la usa la interfaz.
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import sharp from "sharp";
import { createApp } from "../editor/server/app.ts";
import { createGit } from "../editor/server/git.ts";
import type { Preview } from "../editor/server/preview.ts";
import { createStore } from "../editor/server/store.ts";
import { rejectReason, TOKEN_HEADER } from "../editor/server/security.ts";
import { createRepo } from "./helpers.ts";

const repo = createRepo();
after(() => rmSync(repo.base, { recursive: true, force: true }));

const guardConfig = { port: 4555, token: "token-de-prueba" };
const preview: Preview = { start: async () => "http://127.0.0.1:4556/", stop: () => undefined };
const app = createApp({
  root: repo.root,
  store: createStore(repo.root),
  git: createGit(repo.root),
  preview,
  guardConfig,
  uiBundle: "",
});

const HOST = "127.0.0.1:4555";
const call = (path: string, init: RequestInit & { token?: string | null; host?: string } = {}) => {
  const { token = guardConfig.token, host = HOST, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("host", host);
  if (token) headers.set(TOKEN_HEADER, token);
  return app.request(`http://${HOST}${path}`, { ...rest, headers });
};
const postJson = (path: string, data: unknown, method = "POST") =>
  call(path, {
    method,
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });

const product = {
  name: "Taza azul",
  description: "Taza",
  priceCents: 25000,
  brandId: "nike",
  images: [],
  status: "available",
  featured: false,
};

test("sin token no hay acceso a la API", async () => {
  assert.equal((await call("/api/state", { token: null })).status, 403);
  assert.equal((await call("/api/state", { token: "incorrecto" })).status, 403);
});

test("bloquea DNS rebinding por el Host", async () => {
  assert.equal((await call("/api/state", { host: "ataque.example:4555" })).status, 403);
  assert.equal((await call("/", { host: "ataque.example:4555" })).status, 403);
  assert.equal((await call("/api/state", { host: "localhost:4555" })).status, 403);
});

test("bloquea peticiones de otro sitio aunque traigan el token", async () => {
  const headers = { Origin: "https://ataque.example" };
  assert.equal((await call("/api/publish", { method: "POST", headers })).status, 403);
  const reason = rejectReason(
    { path: "/api/state", host: HOST, fetchSite: "cross-site", token: guardConfig.token },
    guardConfig,
  );
  assert.equal(reason, "Sitio no permitido");
});

test("cada respuesta lleva cabeceras de seguridad", async () => {
  const response = await call("/api/state");
  assert.match(response.headers.get("content-security-policy") ?? "", /script-src 'self'/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("no expone archivos fuera de la carpeta de fotos", async () => {
  for (const path of ["/media/..%2f..%2fcontent%2fsite.json", "/media/../../package.json", "/.git/config"]) {
    assert.equal((await call(path)).status, 404, path);
  }
});

test("crea, edita y elimina un producto", async () => {
  const created = await postJson("/api/products", product);
  assert.equal(created.status, 201);
  const { id } = (await created.json()) as { id: string };
  assert.equal(id, "taza-azul");

  const duplicate = await postJson("/api/products", product);
  assert.equal(((await duplicate.json()) as { id: string }).id, "taza-azul-2");

  // Renombrar no cambia la dirección pública.
  const updated = await postJson(`/api/products/${id}`, { ...product, name: "Otra" }, "PUT");
  assert.deepEqual(await updated.json(), { ...product, name: "Otra", id, stock: 1 });

  const stored = JSON.parse(readFileSync(join(repo.root, "content", "products.json"), "utf8"));
  assert.equal(stored.length, 2);

  assert.equal((await call(`/api/products/${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await call(`/api/products/${id}`, { method: "DELETE" })).status, 404);
});

test("explica los datos inválidos y no los guarda", async () => {
  const response = await postJson("/api/products", { ...product, name: " " });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Nombre: este campo es obligatorio." });
});

test("no acepta una foto que no existe", async () => {
  const images = [{ id: "fantasma", width: 10, height: 10 }];
  const response = await postJson("/api/products", { ...product, images });
  assert.equal(response.status, 400);
});

test("sube una foto y la sirve como miniatura", async () => {
  const png = await sharp({
    create: { width: 800, height: 800, channels: 3, background: "#c4eedd" },
  })
    .png()
    .toBuffer();
  const body = new FormData();
  body.append("file", new File([new Uint8Array(png)], "foto.png", { type: "image/png" }));
  body.append("label", "Taza");
  const upload = await call("/api/images", { method: "POST", body });
  assert.equal(upload.status, 201);
  const { id } = (await upload.json()) as { id: string };
  const media = await call(`/media/${id}-480.webp`);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get("content-type"), "image/webp");
});

test("rechaza subidas que superan el límite", async () => {
  const body = new FormData();
  body.append("file", new File([new Uint8Array(11 * 1024 * 1024)], "enorme.png"));
  const upload = await call("/api/images", { method: "POST", body });
  assert.equal(upload.status, 413);
});

test("CRUD de marcas: crear, renombrar y eliminar", async () => {
  const created = await postJson("/api/brands", { name: "Adidas" });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { id: "adidas", name: "Adidas", comingSoon: false });

  // El nombre no se repite aunque cambien mayúsculas o tildes.
  const duplicate = await postJson("/api/brands", { name: " ADIDAS " });
  assert.equal(duplicate.status, 400);
  assert.match(((await duplicate.json()) as { error: string }).error, /Ya existe la marca Adidas/);

  // Renombrar conserva el id, así los productos siguen enlazados.
  const renamed = await postJson("/api/brands/adidas", { name: "adidas Originals", comingSoon: true }, "PUT");
  assert.deepEqual(await renamed.json(), { id: "adidas", name: "adidas Originals", comingSoon: true });

  assert.equal((await call("/api/brands/adidas", { method: "DELETE" })).status, 200);
  assert.equal((await call("/api/brands/adidas", { method: "DELETE" })).status, 404);
});

test("no elimina una marca que tiene productos", async () => {
  const created = await postJson("/api/products", { ...product, name: "Retro" });
  const { id } = (await created.json()) as { id: string };
  const response = await call("/api/brands/nike", { method: "DELETE" });
  assert.equal(response.status, 409);
  assert.match(((await response.json()) as { error: string }).error, /Nike tiene \d+ productos?\. Cámbialos/);
  await call(`/api/products/${id}`, { method: "DELETE" });
});

test("no guarda productos con una marca inexistente", async () => {
  const response = await postJson("/api/products", { ...product, brandId: "fantasma" });
  assert.equal(response.status, 400);
  assert.match(((await response.json()) as { error: string }).error, /marca/);
});

test("avisa si faltan datos de la tienda", async () => {
  const state = (await (await call("/api/state")).json()) as { warnings: string[] };
  assert.deepEqual(state.warnings, []);
  const site = JSON.parse(readFileSync(join(repo.root, "content", "site.json"), "utf8"));
  await postJson("/api/site", { ...site, whatsappNumber: "50400000000" }, "PUT");
  const next = (await (await call("/api/state")).json()) as { warnings: string[] };
  assert.equal(next.warnings.length, 1);
  assert.match(next.warnings[0] ?? "", /WhatsApp/);
});
