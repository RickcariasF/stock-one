// Rutas del editor. Recibe sus dependencias como parámetros para poder probarse aislado.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isPlaceholderUrl, PLACEHOLDER_WHATSAPP } from "../../src/lib/schema.ts";
import { UserError } from "./errors.ts";
import type { Git } from "./git.ts";
import { MAX_UPLOAD_BYTES, removeUnusedImages, saveImage } from "./images.ts";
import type { Preview } from "./preview.ts";
import { guard, securityHeaders, type GuardConfig } from "./security.ts";
import type { Store } from "./store.ts";

const JSON_LIMIT = 256 * 1024;

type Deps = {
  root: string;
  store: Store;
  git: Git;
  preview: Preview;
  guardConfig: GuardConfig;
  /** JavaScript de la interfaz, compilado al arrancar. */
  uiBundle: string;
};

export function createApp({ root, store, git, preview, guardConfig, uiBundle }: Deps) {
  const app = new Hono();

  app.use("*", securityHeaders);
  app.use("*", guard(guardConfig));

  app.onError((error, c) => {
    if (error instanceof UserError) {
      return c.json({ error: error.message }, error.status as 400 | 404 | 409 | 413);
    }
    // El detalle técnico queda en la consola; la interfaz muestra una instrucción clara.
    console.error(error);
    return c.json({ error: "Algo falló en el editor. Ciérralo y ábrelo de nuevo." }, 500);
  });

  // Interfaz
  const uiFile = (name: string) => readFile(join(root, "editor", "ui", name), "utf8");
  app.get("/", async (c) => c.html(await uiFile("index.html")));
  app.get("/styles.css", async (c) =>
    c.body(await uiFile("styles.css"), 200, { "Content-Type": "text/css; charset=utf-8" }),
  );
  // Comparte la paleta con el sitio: al cambiar theme.css cambian ambos.
  app.get("/theme.css", async (c) =>
    c.body(await readFile(join(root, "src", "styles", "theme.css"), "utf8"), 200, {
      "Content-Type": "text/css; charset=utf-8",
    }),
  );
  app.get("/app.js", (c) =>
    c.body(uiBundle, 200, { "Content-Type": "text/javascript; charset=utf-8" }),
  );

  // Logotipo blanco para la barra negra del editor (ruta fija, sin parámetros).
  app.get("/logo-white.png", async (c) => {
    const data = await readFile(join(root, "public", "brand", "logo-white.png")).catch(() => null);
    if (!data) return c.notFound();
    return c.body(new Uint8Array(data), 200, { "Content-Type": "image/png" });
  });

  // Miniaturas. El patrón impide salir de la carpeta de fotos (../).
  app.get("/media/:file{[a-z0-9-]+\\.webp}", async (c) => {
    const data = await readFile(join(store.imagesDir, c.req.param("file"))).catch(() => null);
    if (!data) return c.notFound();
    return c.body(new Uint8Array(data), 200, { "Content-Type": "image/webp" });
  });

  // Estado general
  app.get("/api/state", async (c) => {
    const [products, brands, site, status] = await Promise.all([
      store.readProducts(),
      store.readBrands(),
      store.readSite(),
      git.status(),
    ]);
    const warnings: string[] = [];
    if (site.whatsappNumber === PLACEHOLDER_WHATSAPP) {
      warnings.push("Falta el número de WhatsApp de la tienda. Agrégalo en Ajustes.");
    }
    if (isPlaceholderUrl(site.url)) {
      warnings.push("Falta la dirección del sitio. Agrégala en Ajustes.");
    }
    if (brands.length === 0) {
      warnings.push("Aún no hay marcas. Agrega al menos una en Marcas antes de crear productos.");
    }
    if (!status.connected) {
      warnings.push("Esta carpeta no está conectada a GitHub. Puedes editar, pero no publicar.");
    }
    return c.json({ products, brands, site, git: status, warnings });
  });

  // Productos
  const json = bodyLimit({ maxSize: JSON_LIMIT });
  app.post("/api/products", json, async (c) =>
    c.json(await store.createProduct(await c.req.json()), 201),
  );
  app.put("/api/products/:id", json, async (c) =>
    c.json(await store.updateProduct(c.req.param("id"), await c.req.json())),
  );
  app.delete("/api/products/:id", async (c) => {
    await store.deleteProduct(c.req.param("id"));
    return c.json({ ok: true });
  });

  // Marcas
  app.post("/api/brands", json, async (c) => c.json(await store.createBrand(await c.req.json()), 201));
  app.put("/api/brands/:id", json, async (c) =>
    c.json(await store.updateBrand(c.req.param("id"), await c.req.json())),
  );
  app.delete("/api/brands/:id", async (c) => {
    await store.deleteBrand(c.req.param("id"));
    return c.json({ ok: true });
  });

  // Fotos
  app.post(
    "/api/images",
    bodyLimit({
      // Margen para los separadores del formulario multipart.
      maxSize: MAX_UPLOAD_BYTES + 64 * 1024,
      onError: () => {
        throw new UserError("La foto pesa más de 10 MB.", 413);
      },
    }),
    async (c) => {
      const form = await c.req.parseBody();
      const { file, label } = form;
      if (!(file instanceof File)) throw new UserError("Elige una foto.");
      await store.ensureImagesDir();
      const data = Buffer.from(await file.arrayBuffer());
      const name = typeof label === "string" ? label : "foto";
      return c.json(await saveImage(data, name, store.imagesDir), 201);
    },
  );

  // Ajustes
  app.put("/api/site", json, async (c) => c.json(await store.updateSite(await c.req.json())));

  // GitHub
  app.post("/api/update", async (c) => c.json(await store.serial(git.update)));
  app.post("/api/discard", async (c) => {
    await store.serial(git.discard);
    return c.json({ ok: true });
  });
  app.post("/api/publish", async (c) =>
    c.json(
      await store.serial(async () => {
        // Revalida todo y limpia fotos huérfanas antes de que salgan del equipo.
        const { products } = await store.readAll();
        const used = new Set(products.flatMap((product) => product.images.map(({ id }) => id)));
        await store.ensureImagesDir();
        await removeUnusedImages(used, store.imagesDir);
        const count = products.length;
        return git.publish(`catálogo: actualización desde el editor (${count} productos)`);
      }),
    ),
  );

  /** Confirma que Cloudflare ya sirve la versión enviada. La URL viene de la configuración. */
  app.get("/api/publish/live", async (c) => {
    const sha = c.req.query("sha");
    const { url } = await store.readSite();
    const live = await fetch(new URL("/version.json", url), {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
      .then((response) => (response.ok ? (response.json() as Promise<{ sha?: string }>) : null))
      .catch(() => null);
    return c.json({ live: Boolean(sha) && live?.sha === sha, url });
  });

  // Vista previa
  app.post("/api/preview", async (c) => c.json({ url: await preview.start() }));

  return app;
}
