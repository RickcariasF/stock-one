# Stock One — contexto para Claude Code

Catálogo online **estático** de zapatos y sneakers de varias marcas (hoy vende NUMERIS). El cliente
elige un par y lo pide por WhatsApp; el vendedor gestiona la venta en el chat. Lo construye Ricardo
para la tienda de un amigo y como proyecto de portafolio DevOps. Objetivo: costo cero, simple, y
crecer paso a paso sin microservicios por ahora.

## Cómo trabajar con el dueño

- Responde en español. Comentarios del código en español, breves y útiles.
- Ricardo está aprendiendo DevOps: cuando des un comando, explica en una línea qué hace.
- Sé conciso: prioriza cambios pequeños y verificables sobre explicaciones largas.
- Antes de dar algo por terminado: `pnpm check` y `pnpm build` en verde.
- **Mantén este archivo al día** cuando cambie la arquitectura, un flujo, una decisión o el roadmap.

## Arquitectura

```
Editor local (127.0.0.1:4555) ──guarda──> content/*.json + public/products/*.webp
        │ Publicar = git commit (solo contenido) + pull --rebase + push a main
        ▼
GitHub (RickcariasF/stock-one) ──> Actions: check + build ──> wrangler deploy ──> Cloudflare Workers (estático)
                                                                         Cliente ──> wa.me con mensaje prellenado
```

- **Sitio:** Next.js 16 con `output: "export"`. En producción no corre ningún servidor ni base de datos.
- **"Base de datos":** archivos JSON versionados con Git. El historial sirve de respaldo y reversión.
- **Editor:** reemplaza al panel de administración. No hay login ni panel en línea, a propósito.
- **WhatsApp:** enlaces `wa.me/<número>?text=...`. No se usa la API de WhatsApp.

## Stack y versiones

Node 24 (`.nvmrc`) · pnpm 12.16.1 · Next 16 + React 19 · TypeScript 6 (ESLint aún no soporta TS 7) ·
Tailwind CSS 4 · Zod 4 · Hono (servidor del editor) · esbuild (interfaz del editor) · sharp (fotos) ·
Wrangler (Cloudflare) · `node:test` + tsx para pruebas.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Sitio en desarrollo en http://127.0.0.1:3000 |
| `pnpm editor` | Editor local en http://127.0.0.1:4555 (vista previa en el puerto 4556) |
| `pnpm check` | Tipos, lint y pruebas (lo mismo que corre CI) |
| `pnpm build` | Exporta a `out/` y aplica la CSP por página (`scripts/postbuild.mjs`) |
| `pnpm preview` | Sirve `out/` con Wrangler en el puerto 8787, con las cabeceras reales |
| `pnpm migrate:brands` | Convierte un catálogo antiguo con categorías en marcas (idempotente) |

## Mapa del código

```
content/products.json   Productos      content/brands.json   Marcas      content/site.json   Tienda
public/products/        Fotos WebP generadas por el editor (<id>-480.webp y <id>-1200.webp)
public/brand/           Logos recortados (logo.png para fondos claros, logo-white.png para oscuros)
public/_headers         Cabeceras de seguridad que aplica Cloudflare
src/lib/schema.ts       Contrato de datos (Zod) compartido por sitio, editor y CI. EMPIEZA AQUÍ
src/lib/catalog.ts      Lee y valida el contenido al compilar; si falla, no hay despliegue
src/lib/visibility.ts   Qué se muestra: productos visibles y marcas del filtro (funciones puras)
src/lib/whatsapp.ts     Mensaje y enlace de pedido
src/components/         Hero (animación de mensaje), CatalogBrowser (filtro por marca), Gallery (carrusel)...
src/styles/theme.css    ÚNICO archivo con colores (variables --stock-one-*)
editor/server/          app.ts (rutas), store.ts (CRUD serializado), git.ts, images.ts, security.ts, migrate.ts
editor/ui/main.ts       Interfaz del editor en TypeScript plano, sin framework
scripts/                postbuild.mjs (CSP), setup-wsl.sh, instalar-stock-one.bat, migrate-brands.ts
brand/                  MANUAL-DE-MARCA.md (fuente de verdad visual) y logos originales
imagenes-ignore/        Fotos de origen sin procesar (ignorada por Git)
docs/                   DESPLIEGUE.md, GUIA-EDITOR.md, SEGURIDAD.md
```

## Modelo de datos (ver `src/lib/schema.ts`)

- **Product:** `id` (slug y URL pública: no cambia al renombrar), `name`, `description`,
  `priceCents` (entero, en centavos), `brandId`, `images` (hasta 8; la primera es la principal),
  `status` (`available` | `sold_out` | `hidden`), `featured`, `stock` (entero; por defecto 1).
- **Brand:** `id` (estable), `name` (único, sin distinguir mayúsculas ni tildes), `comingSoon`.
- **Site:** nombre, frase, `url` (https), `whatsappNumber` (solo dígitos con código de país),
  saludo, `currency` HNL (lempiras, "L 100.00") y `locale` es-HN.

Reglas de negocio:
- Agotado = `status: "sold_out"` **o** `stock === 0`.
- Una marca con `comingSoon` aparece en el filtro con el aviso "Próximamente", y sus productos
  quedan ocultos: no salen en la lista ni se generan sus páginas.
- Una marca con productos no se puede eliminar. Cada producto debe apuntar a una marca existente,
  y lo validan el editor, la compilación y CI.
- El mensaje de WhatsApp usa "Marca + modelo (precio)" y el enlace al producto, sin repetir la marca.
- Dominios `.example` son de relleno: el editor avisa mientras sigan en `site.json`.

## Reglas que no se deben romper

**Seguridad**
- Todo texto del catálogo es texto plano: nada de `dangerouslySetInnerHTML` con contenido del
  usuario. La única excepción es el JSON-LD, que ya escapa `<`.
- CSP estricta: los scripts en línea solo funcionan con su huella, que agrega `postbuild.mjs`. No
  agregues scripts ni estilos externos. Las fuentes son locales (Fontsource).
- El editor solo escucha en `127.0.0.1` y exige `Host`, `Origin`, `Sec-Fetch-Site` y el token de
  sesión (`x-stock-one-token`). No relajes `editor/server/security.ts`.
- Las fotos siempre pasan por `saveImage`: detección de formato por contenido (JPG, PNG o WebP; nunca
  SVG), límites de tamaño y recodificación a WebP, que borra EXIF y GPS. Los ids los genera el servidor.
- Git se ejecuta sin shell y el editor solo publica `content/` y `public/products/` (`CONTENT_PATHS`).
- Cadena de suministro: lockfile congelado; `minimumReleaseAge` de 3 días (pnpm rechaza versiones más
  nuevas, así que no es un error); ningún script de instalación (`allowBuilds: false`); acciones de
  GitHub fijadas por hash. El override `semver@^6: 6.3.1` es temporal.
- Nunca subas secretos. Los de Cloudflare viven solo en el entorno `production` de GitHub.

**Marca** (detalle en `brand/MANUAL-DE-MARCA.md`)
- Blanco de fondo; negro para la barra, el hero, el pie y los títulos; dorado `#BC9C22` para la acción
  principal, la marca activa y el precio destacado; morado `#65428A` solo para foco y detalles.
- Contraste mínimo de 4.5:1. El dorado **nunca** va como texto sobre blanco (2.7:1): úsalo de fondo con
  texto negro, o como texto sobre negro.
- Tipografía Archivo: condensada y extra negrita (`.condensed`) para el nombre, las marcas y los títulos.
- Sin degradados ni sombras pesadas. La única animación automática es la del hero.
- No alteres los logos de Stock One ni los de las marcas exhibidas. `themeColor` = `#FFFFFF`.

**Código**
- Los colores solo se definen en `src/styles/theme.css`, con el prefijo `--stock-one-`.
- `src/` importa sin extensión (`./schema`); `editor/`, `scripts/` y `tests/` importan con `.ts`.
- Cambios en datos: actualiza el esquema y mantén la compatibilidad con catálogos existentes (con
  `.default()` o una migración idempotente). No rompas los JSON que ya están en `main`.
- Agrega o ajusta pruebas en `tests/` con cada regla nueva.

## CI/CD y operaciones

- `.github/workflows/deploy.yml`:
  - **build:** `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build` y el artefacto `out/`.
  - **deploy:** solo en `main`, en el entorno `production` y con `concurrency` para no interrumpir
    despliegues. Descarga el artefacto y ejecuta `wrangler deploy`, sin compilar: es el único que ve
    los secretos.
  - Los pull requests solo validan.
- `security.yml`: `pnpm audit` cada lunes. `dependabot.yml`: actualizaciones semanales agrupadas.
- El sitio expone `/version.json` con el SHA desplegado; el editor lo consulta para confirmar
  "Publicado".
- Reversión: `pnpm exec wrangler rollback`. Luego corrige en `main`, porque el siguiente despliegue
  usa lo que haya ahí.
- Dos flujos:
  - **Contenido:** editor → push directo a `main`. Por eso la regla de `main` bloquea force push y
    borrado, pero no exige pull request.
  - **Código:** rama → pull request → CI → merge → despliegue automático.

## Entorno de desarrollo

- Ubuntu 24.04 en WSL2, proyecto en `~/labs/stock-one`. La copia en
  `C:\Users\Ricardo\Documents\DEVOPS PATH\stock-one` es solo respaldo.
- GitHub `RickcariasF` por SSH. `scripts/setup-wsl.sh` instala Node (nvm) y pnpm, y valida el proyecto.
- El editor abre el navegador de Windows con `rundll32.exe` cuando detecta WSL.
- La computadora del editor (Windows) se prepara con `scripts/instalar-stock-one.bat` y el editor se
  abre con `StockOne-Editor.bat`.

## Estado actual y camino

Hecho: catálogo, editor con CRUD de productos y marcas, "Próximamente", existencias, carrusel, logos,
23 productos NUMERIS cargados (L 100, existencias 1; las descripciones aún deben revisarse) y
pipeline listo.

Pendiente, en orden (detalle en `docs/DESPLIEGUE.md`):
1. Crear el repo `RickcariasF/stock-one`, hacer el primer push y proteger `main`.
2. Cloudflare: subdominio `workers.dev`, token con solo `Workers Scripts: Edit` y Account ID, todo en el
   entorno `production`. El sitio quedará en `stock-one.<subdominio>.workers.dev`.
3. En el editor, en Ajustes: número de WhatsApp real y la URL definitiva. Publicar y verificar el
   pipeline.
4. Probar el flujo de pull y push: actualizar, conflicto, descartar, CI en rojo y rollback.
5. Agregar al amigo como colaborador (Write y verificación en dos pasos).

Ideas futuras (sin microservicios por ahora): tallas por producto, logos de marcas, carrito que arme un
mensaje con varios pares, analítica sin cookies y dominio propio (Cloudflare Registrar, unos USD 10 al
año). Si las fotos pasan de cerca de 1 GB en el repo, moverlas a Cloudflare R2.
