// Punto de entrada del editor: compila la interfaz, escucha solo en este equipo y abre el navegador.
import { execFile } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { build } from "esbuild";
import { createApp } from "./app.ts";
import { createGit } from "./git.ts";
import { createPreview } from "./preview.ts";
import { createToken } from "./security.ts";
import { createStore } from "./store.ts";

const PORT = 4555;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function bundleUi() {
  const result = await build({
    entryPoints: [join(root, "editor", "ui", "main.ts")],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    minify: true,
  });
  const output = result.outputFiles[0];
  if (!output) throw new Error("No se pudo compilar la interfaz del editor");
  return output.text;
}

/** Elige el comando que abre el navegador en cada sistema. */
function browserCommand(url: string) {
  if (process.platform === "win32") return ["rundll32", "url.dll,FileProtocolHandler", url];
  if (process.platform === "darwin") return ["open", url];
  // En WSL el navegador vive en Windows y se alcanza por la interoperabilidad del sistema.
  if (process.env.WSL_DISTRO_NAME) return ["rundll32.exe", "url.dll,FileProtocolHandler", url];
  return ["xdg-open", url];
}

/** Abre el navegador sin shell, para que el sistema no interprete la dirección. */
function openBrowser(url: string) {
  const [command, ...args] = browserCommand(url);
  execFile(command as string, args, (error) => {
    if (error) console.log("Abre manualmente la dirección de arriba en tu navegador.");
  });
}

const token = createToken();
const preview = createPreview(root);
const store = createStore(root);

// Catálogos anteriores usaban categorías: se convierten en marcas sin perder datos.
const migrated = await store.migrate();
if (migrated !== null) console.log(`Catálogo actualizado: ${migrated} marcas creadas a partir de las categorías.`);

const app = createApp({
  root,
  store,
  git: createGit(root),
  preview,
  guardConfig: { port: PORT, token },
  uiBundle: await bundleUi(),
});

// 127.0.0.1: el editor no es accesible desde la red, ni siquiera desde la misma WiFi.
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: PORT }, () => {
  // El token va después de #: el navegador no lo envía al servidor ni a otros sitios.
  const url = `http://127.0.0.1:${PORT}/#token=${token}`;
  console.log(`\nEditor de Stock One abierto en:\n${url}\n\nCierra esta ventana para apagarlo.`);
  openBrowser(url);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "El editor ya está abierto. Cierra la otra ventana e intenta de nuevo."
      : error.message,
  );
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    preview.stop();
    process.exit(0);
  });
}
