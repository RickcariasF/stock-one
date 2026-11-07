// Publicación real contra un remoto local: no toca GitHub.
import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { createGit } from "../editor/server/git.ts";
import { createRepo, git } from "./helpers.ts";

const repo = createRepo();
after(() => rmSync(repo.base, { recursive: true, force: true }));

const editor = createGit(repo.root);
const products = join(repo.root, "content", "products.json");
const remoteLog = () => git(repo.remote, "log", "--oneline", "main");
const remoteFiles = () => git(repo.remote, "show", "--name-only", "--format=", "main").split("\n");

test("sin cambios no publica nada", async () => {
  assert.equal((await editor.publish("sin cambios")).published, false);
});

test("cuenta y publica solo las carpetas de contenido", async () => {
  writeFileSync(products, '[{"id":"nuevo"}]\n');
  writeFileSync(join(repo.root, "public", "products", "foto-480.webp"), "imagen");
  // Un cambio en el código no debe viajar con la publicación del catálogo.
  writeFileSync(join(repo.root, "README.md"), "cambio ajeno\n");

  assert.equal((await editor.status()).pendingChanges, 2);
  const result = await editor.publish("catálogo: prueba");

  assert.equal(result.published, true);
  assert.equal(result.sha, git(repo.remote, "rev-parse", "main"));
  assert.deepEqual(remoteFiles().sort(), ["content/products.json", "public/products/foto-480.webp"]);
  assert.match(remoteLog(), /catálogo: prueba/);
  assert.equal(git(repo.root, "status", "--porcelain", "--", "README.md"), "M README.md");
  git(repo.root, "checkout", "--", "README.md");
});

test("actualizar se niega si hay cambios sin publicar", async () => {
  writeFileSync(products, "[]\n");
  await assert.rejects(editor.update(), /sin publicar/);
});

test("descartar vuelve a lo publicado y borra archivos nuevos", async () => {
  const orphan = join(repo.root, "public", "products", "sobrante-480.webp");
  writeFileSync(orphan, "x");
  await editor.discard();
  assert.equal((await editor.status()).pendingChanges, 0);
  assert.equal(existsSync(orphan), false);
});

test("incorpora cambios remotos antes de enviar", async () => {
  const other = join(repo.base, "otro");
  git(repo.base, "clone", repo.remote, other);
  git(other, "config", "user.name", "Otra persona");
  git(other, "config", "user.email", "otra@example.com");
  writeFileSync(join(other, "README.md"), "cambio remoto\n");
  git(other, "commit", "-am", "cambio de código");
  git(other, "push", "origin", "main");

  writeFileSync(join(repo.root, "public", "products", "nueva-480.webp"), "x");
  assert.equal((await editor.publish("catálogo: con remoto")).published, true);
  assert.match(remoteLog(), /cambio de código/);
  assert.match(remoteLog(), /catálogo: con remoto/);
});

test("ante un conflicto no pierde el trabajo y explica el problema", async () => {
  const other = join(repo.base, "otro");
  git(other, "pull");
  writeFileSync(join(other, "content", "products.json"), '[{"id":"remoto"}]\n');
  git(other, "commit", "-am", "catálogo remoto");
  git(other, "push", "origin", "main");

  writeFileSync(products, '[{"id":"local"}]\n');
  await assert.rejects(editor.publish("catálogo: choque"), /chocan/);
  // El rebase quedó abortado y el commit local sigue disponible.
  assert.equal(git(repo.root, "status", "--porcelain=v1", "--branch").includes("rebase"), false);
  assert.match(git(repo.root, "log", "--oneline", "-1"), /catálogo: choque/);
});

test("exige estar en la rama principal", async () => {
  git(repo.root, "switch", "-c", "otra-rama");
  await assert.rejects(editor.publish("x"), /Cambia a main/);
  await assert.rejects(editor.update(), /Cambia a main/);
  git(repo.root, "switch", "main");
});
