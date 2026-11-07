import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = {
  name: "Stock One",
  tagline: "Bienvenida",
  url: "https://stock-one.prueba.workers.dev",
  whatsappNumber: "50499990000",
  whatsappGreeting: "Hola",
  currency: "HNL",
  locale: "es-HN",
};

export const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Crea un remoto vacío y un clon con contenido mínimo, como el proyecto real. */
export function createRepo() {
  const base = mkdtempSync(join(tmpdir(), "stock-one-repo-"));
  const remote = join(base, "remote.git");
  const root = join(base, "work");
  git(base, "init", "--bare", "--initial-branch=main", remote);
  git(base, "clone", remote, root);
  git(root, "config", "user.name", "Prueba");
  git(root, "config", "user.email", "prueba@example.com");
  git(root, "switch", "-c", "main");
  mkdirSync(join(root, "content"));
  mkdirSync(join(root, "public", "products"), { recursive: true });
  writeFileSync(join(root, "content", "products.json"), "[]\n");
  writeFileSync(join(root, "content", "brands.json"), `${JSON.stringify([{ id: "nike", name: "Nike" }])}\n`);
  writeFileSync(join(root, "content", "site.json"), `${JSON.stringify(SITE, null, 2)}\n`);
  writeFileSync(join(root, "README.md"), "base\n");
  writeFileSync(join(root, "public", "products", ".gitkeep"), "");
  git(root, "add", ".");
  git(root, "commit", "-m", "inicio");
  git(root, "push", "origin", "main");
  return { base, remote, root };
}

