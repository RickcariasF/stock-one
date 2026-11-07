// Interfaz del editor. Todo el texto entra al DOM como textContent, nunca como HTML.
import type { Brand, Product, ProductImage, ProductInput, ProductStatus, Site } from "../../src/lib/schema.ts";
import { parsePrice, priceToText } from "./price.ts";

type GitStatus = { connected: boolean; branch: string | null; pendingChanges: number };
type State = { products: Product[]; brands: Brand[]; site: Site; git: GitStatus; warnings: string[] };

const STATUS_LABELS: Record<ProductStatus, string> = {
  available: "Disponible",
  sold_out: "Agotado",
  hidden: "Oculto (no aparece en la tienda)",
};

// Sesión. El token cambia en cada arranque, así que renombrar la clave no pierde datos.
const TOKEN_KEY = "stock-one-token";

/** El token llega en el fragmento de la dirección; se retira para que no quede a la vista. */
function readToken(): string | null {
  const match = /token=([\w-]+)/.exec(location.hash);
  try {
    if (match?.[1]) {
      sessionStorage.setItem(TOKEN_KEY, match[1]);
      history.replaceState(null, "", location.pathname);
      return match[1];
    }
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return match?.[1] ?? null;
  }
}

const token = readToken();

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "x-stock-one-token": token ?? "", ...init.headers },
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? "No se pudo completar la acción.");
  return body as T;
}

const sendJson = <T>(path: string, method: string, data: unknown) =>
  api<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// Utilidad para crear elementos sin escribir HTML
type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.includes("-")) element.setAttribute(key, String(value));
    else (element as unknown as Props)[key] = value;
  }
  for (const child of children) {
    if (child) element.append(child);
  }
  return element;
}

function toast(message: string, isError = false) {
  const item = h("div", { className: `toast${isError ? " error" : ""}` }, message);
  document.querySelector("#toasts")?.append(item);
  setTimeout(() => item.remove(), isError ? 8000 : 4000);
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la acción.";

/** Marcas en orden alfabético para listas y selectores. */
const sortedBrands = () => [...state.brands].sort((a, b) => a.name.localeCompare(b.name, "es"));
const brandName = (id: string) => state.brands.find((brand) => brand.id === id)?.name ?? "Sin marca";
const isBrandSoon = (id: string) => state.brands.some((brand) => brand.id === id && brand.comingSoon);

/** "HNL" → "lempiras", según el formato regional de la tienda. */
function currencyName() {
  if (state.site.currency === "HNL") return "lempiras";
  try {
    return new Intl.DisplayNames(state.site.locale, { type: "currency" }).of(state.site.currency) ?? state.site.currency;
  } catch {
    return state.site.currency;
  }
}

// Estado de la pantalla
let state: State;
let view: "products" | "brands" | "settings" = "products";
let search = "";
let busy: string | null = null;

const app = document.querySelector<HTMLElement>("#app") as HTMLElement;

/** Zona fija para avisos: se actualiza sola, sin redibujar formularios a medio llenar. */
const noticeSlot = h("div");
const setNotice = (node: Node) => noticeSlot.replaceChildren(node);

async function refresh() {
  state = await api<State>("/api/state");
  render();
}

/** Ejecuta una acción larga bloqueando los botones para evitar dobles clics. */
async function withBusy(label: string, task: () => Promise<void>) {
  busy = label;
  render();
  try {
    await task();
  } catch (error) {
    toast(errorText(error), true);
  } finally {
    busy = null;
    await refresh().catch((error) => toast(errorText(error), true));
  }
}

// Diálogos
function openDialog(content: (close: () => void) => Node[]) {
  const dialog = h("dialog");
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.append(...content(close));
  dialog.addEventListener("cancel", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function confirmDialog(options: {
  title: string;
  text: string;
  action: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  openDialog((close) => [
    h("h2", {}, options.title),
    h("p", {}, options.text),
    h(
      "div",
      { className: "dialog-actions" },
      h("button", { className: "button", type: "button", onclick: close }, "Cancelar"),
      h(
        "button",
        {
          className: `button ${options.danger ? "danger solid" : "primary"}`,
          type: "button",
          onclick: () => {
            close();
            options.onConfirm();
          },
        },
        options.action,
      ),
    ),
  ]);
}

// Acciones de GitHub
function publish() {
  const pending = state.git.pendingChanges;
  confirmDialog({
    title: "Publicar cambios",
    text: `Se enviarán tus cambios (${pending} ${pending === 1 ? "archivo" : "archivos"}) y la tienda se actualizará en unos minutos.`,
    action: "Publicar",
    onConfirm: () =>
      void withBusy("Publicando...", async () => {
        const result = await api<{ published: boolean; sha: string }>("/api/publish", {
          method: "POST",
        });
        if (!result.published) {
          toast("No hay cambios para publicar.");
          return;
        }
        watchDeployment(result.sha);
      }),
  });
}

/** Consulta el sitio público hasta ver la versión recién enviada. */
function watchDeployment(sha: string) {
  setNotice(h("div", { className: "result" }, "Publicando. La tienda suele actualizarse en 2 o 3 minutos."));
  const startedAt = Date.now();
  const check = async () => {
    const { live, url } = await api<{ live: boolean; url: string }>(
      `/api/publish/live?sha=${encodeURIComponent(sha)}`,
    ).catch(() => ({ live: false, url: state.site.url }));
    if (live) {
      setNotice(
        h(
          "div",
          { className: "result" },
          "Publicado. ",
          h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, "Ver la tienda"),
        ),
      );
    } else if (Date.now() - startedAt > 8 * 60_000) {
      setNotice(
        h(
          "div",
          { className: "warning" },
          "La tienda aún no muestra los cambios. Avisa a quien administra el proyecto para revisar el despliegue.",
        ),
      );
    } else {
      setTimeout(() => void check(), 10_000);
    }
  };
  setTimeout(() => void check(), 10_000);
}

function updateFromGitHub() {
  void withBusy("Actualizando...", async () => {
    const { changed } = await api<{ changed: boolean }>("/api/update", { method: "POST" });
    toast(changed ? "Actualizado con la última versión." : "Ya tienes la última versión.");
  });
}

function discard() {
  confirmDialog({
    title: "Descartar cambios",
    text: "Se perderán todos los cambios que no has publicado. Esta acción no se puede deshacer.",
    action: "Descartar cambios",
    danger: true,
    onConfirm: () =>
      void withBusy("Descartando...", async () => {
        await api("/api/discard", { method: "POST" });
        toast("Cambios descartados.");
      }),
  });
}

function openPreview() {
  void withBusy("Preparando vista previa...", async () => {
    const { url } = await api<{ url: string }>("/api/preview", { method: "POST" });
    setNotice(
      h(
        "div",
        { className: "result" },
        "La vista previa está lista. ",
        h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, "Abrir vista previa"),
      ),
    );
  });
}

// Formulario de marca
/** Crea o renombra una marca. `onSaved` permite usarlo desde el formulario de producto. */
function brandDialog(brand?: Brand, onSaved?: (saved: Brand) => void) {
  openDialog((close) => {
    const name = h("input", { type: "text", required: true, maxLength: 40, value: brand?.name ?? "" });
    const comingSoon = h("input", { type: "checkbox", checked: brand?.comingSoon ?? false });
    const formError = h("p", { className: "warning", hidden: true, role: "alert" });
    const inUse = brand ? state.products.filter((p) => p.brandId === brand.id).length : 0;

    async function save(event: SubmitEvent) {
      event.preventDefault();
      formError.hidden = true;
      try {
        const saved = brand
          ? await sendJson<Brand>(`/api/brands/${brand.id}`, "PUT", { name: name.value, comingSoon: comingSoon.checked })
          : await sendJson<Brand>("/api/brands", "POST", { name: name.value, comingSoon: comingSoon.checked });
        close();
        toast(brand ? "Marca guardada." : "Marca agregada.");
        state.brands = brand
          ? state.brands.map((b) => (b.id === saved.id ? saved : b))
          : [...state.brands, saved];
        onSaved?.(saved);
        await refresh();
      } catch (error) {
        formError.textContent = errorText(error);
        formError.hidden = false;
      }
    }

    function remove() {
      if (!brand) return;
      close();
      confirmDialog({
        title: "Eliminar marca",
        text: `Se eliminará la marca ${brand.name}.`,
        action: "Eliminar marca",
        danger: true,
        onConfirm: () =>
          void withBusy("Eliminando...", async () => {
            await api(`/api/brands/${brand.id}`, { method: "DELETE" });
            toast("Marca eliminada.");
          }),
      });
    }

    return [
      h("h2", {}, brand ? "Editar marca" : "Agregar marca"),
      h(
        "form",
        { onsubmit: (event: SubmitEvent) => void save(event) },
        h("label", { className: "field" }, h("span", {}, "Nombre"), name),
        h("label", { className: "check" }, comingSoon, h("span", {}, "Próximamente")),
        h(
          "p",
          { className: "hint" },
          "La marca aparece en la tienda con el aviso Próximamente y sus productos quedan ocultos hasta que la desactives.",
        ),
        brand &&
          inUse > 0 &&
          h(
            "p",
            { className: "hint" },
            `La usan ${inUse === 1 ? "1 producto" : `${inUse} productos`}. Para eliminarla, cámbialos primero de marca.`,
          ),
        formError,
        h(
          "div",
          { className: "dialog-actions" },
          brand &&
            h(
              "button",
              { className: "button danger", type: "button", disabled: inUse > 0, onclick: remove },
              "Eliminar",
            ),
          h("span", { className: "spacer" }),
          h("button", { className: "button", type: "button", onclick: close }, "Cancelar"),
          h("button", { className: "button primary", type: "submit" }, "Guardar"),
        ),
      ),
    ];
  });
}

// Formulario de producto
/** Miniatura con acciones. La primera foto es la principal: la de la tarjeta y la portada del carrusel. */
function photoItem(
  image: ProductImage,
  position: { index: number; total: number },
  actions: { remove: () => void; move: (delta: number) => void },
) {
  return h(
    "li",
    { className: "photo" },
    h("img", { src: `/media/${image.id}-480.webp`, alt: `Foto ${position.index + 1}` }),
    position.index === 0 && h("span", { className: "main-photo" }, "Principal"),
    h("button", { type: "button", className: "remove", "aria-label": "Quitar foto", onclick: actions.remove }, "Quitar"),
    h(
      "div",
      { className: "move" },
      h("button", {
        type: "button",
        "aria-label": "Mover a la izquierda",
        disabled: position.index === 0,
        onclick: () => actions.move(-1),
        textContent: "‹",
      }),
      h("button", {
        type: "button",
        "aria-label": "Mover a la derecha",
        disabled: position.index === position.total - 1,
        onclick: () => actions.move(1),
        textContent: "›",
      }),
    ),
  );
}

function productDialog(product?: Product) {
  let images: ProductImage[] = [...(product?.images ?? [])];

  openDialog((close) => {
    const name = h("input", { type: "text", required: true, maxLength: 120, value: product?.name ?? "" });
    const price = h("input", {
      type: "text",
      inputMode: "decimal",
      required: true,
      value: product ? priceToText(product.priceCents) : "",
    });
    const brand = h("select", { required: true, id: "product-brand" });
    /** Rellena el selector; se repite al crear una marca sin cerrar el formulario. */
    const fillBrands = (selected: string) => {
      brand.replaceChildren(
        h("option", { value: "", disabled: true, selected: !selected }, "Elige una marca"),
        ...sortedBrands().map((b) => h("option", { value: b.id, selected: b.id === selected }, b.name)),
      );
    };
    fillBrands(product?.brandId ?? "");
    const newBrand = h(
      "button",
      {
        className: "link",
        type: "button",
        onclick: () => brandDialog(undefined, (saved) => fillBrands(saved.id)),
      },
      "Nueva marca",
    );
    const description = h("textarea", {
      required: true,
      maxLength: 2000,
      value: product?.description ?? "",
    });
    const status = h(
      "select",
      {},
      ...(Object.keys(STATUS_LABELS) as ProductStatus[]).map((value) =>
        h("option", { value, selected: (product?.status ?? "available") === value }, STATUS_LABELS[value]),
      ),
    );
    const featured = h("input", { type: "checkbox", checked: product?.featured ?? false });
    const stock = h("input", {
      type: "number",
      min: 0,
      step: 1,
      required: true,
      inputMode: "numeric",
      value: String(product?.stock ?? 1),
    });
    const formError = h("p", { className: "warning", hidden: true, role: "alert" });
    const photos = h("ul", { className: "photos" });

    const showError = (message: string) => {
      formError.textContent = message;
      formError.hidden = false;
    };

    const fileInput = h("input", {
      type: "file",
      multiple: true,
      accept: "image/jpeg,image/png,image/webp",
      onchange: () => void upload(),
    });
    const uploadLabel = h("label", { className: "upload" }, h("span", {}, "Agregar fotos"), fileInput);

    function renderPhotos() {
      photos.replaceChildren(
        ...images.map((image, index) =>
          photoItem(
            image,
            { index, total: images.length },
            {
              remove: () => {
                images = images.filter(({ id }) => id !== image.id);
                renderPhotos();
              },
              move: (delta) => {
                const next = [...images];
                const [moved] = next.splice(index, 1);
                if (moved) next.splice(index + delta, 0, moved);
                images = next;
                renderPhotos();
              },
            },
          ),
        ),
        ...(images.length < 8 ? [h("li", {}, uploadLabel)] : []),
      );
    }

    async function upload() {
      const files = [...(fileInput.files ?? [])];
      fileInput.value = "";
      formError.hidden = true;
      for (const file of files) {
        if (images.length >= 8) {
          showError("Cada producto admite hasta 8 fotos.");
          return;
        }
        const body = new FormData();
        body.append("file", file);
        body.append("label", name.value || "foto");
        try {
          images = [...images, await api<ProductImage>("/api/images", { method: "POST", body })];
          renderPhotos();
        } catch (error) {
          showError(`${file.name}: ${errorText(error)}`);
        }
      }
    }

    async function save(event: SubmitEvent) {
      event.preventDefault();
      formError.hidden = true;
      const priceCents = parsePrice(price.value);
      if (priceCents === null) {
        showError("Precio: escribe un número, por ejemplo 250 o 250.50.");
        return;
      }
      const input: ProductInput = {
        name: name.value,
        priceCents,
        brandId: brand.value,
        description: description.value,
        images,
        status: status.value as ProductStatus,
        stock: Number(stock.value),
        featured: featured.checked,
      };
      try {
        if (product) await sendJson(`/api/products/${product.id}`, "PUT", input);
        else await sendJson("/api/products", "POST", input);
        close();
        toast(product ? "Producto guardado." : "Producto agregado.");
        await refresh();
      } catch (error) {
        showError(errorText(error));
      }
    }

    function remove() {
      if (!product) return;
      close();
      confirmDialog({
        title: "Eliminar producto",
        text: `Se eliminará "${product.name}". Dejará de verse en la tienda cuando publiques.`,
        action: "Eliminar producto",
        danger: true,
        onConfirm: () =>
          void withBusy("Eliminando...", async () => {
            await api(`/api/products/${product.id}`, { method: "DELETE" });
            toast("Producto eliminado.");
          }),
      });
    }

    renderPhotos();

    return [
      h("h2", {}, product ? "Editar producto" : "Agregar producto"),
      h(
        "form",
        { onsubmit: (event: SubmitEvent) => void save(event) },
        h("div", { className: "field" }, h("span", {}, "Fotos"), photos),
        h("label", { className: "field" }, h("span", {}, "Nombre"), name),
        h(
          "div",
          { className: "columns" },
          h("label", { className: "field" }, h("span", {}, `Precio (${currencyName()})`), price),
          h(
            "div",
            { className: "field" },
            h("label", { htmlFor: "product-brand" }, h("span", {}, "Marca")),
            brand,
            h("small", {}, newBrand),
          ),
        ),
        h("label", { className: "field" }, h("span", {}, "Descripción"), description),
        h(
          "div",
          { className: "columns" },
          h("label", { className: "field" }, h("span", {}, "Estado"), status),
          h(
            "label",
            { className: "field" },
            h("span", {}, "Existencias"),
            stock,
            h("small", {}, "En 0 se muestra como agotado."),
          ),
        ),
        h("label", { className: "check" }, featured, h("span", {}, "Destacar en la tienda")),
        formError,
        h(
          "div",
          { className: "dialog-actions" },
          product &&
            h("button", { className: "button danger", type: "button", onclick: remove }, "Eliminar"),
          h("span", { className: "spacer" }),
          h("button", { className: "button", type: "button", onclick: close }, "Cancelar"),
          h("button", { className: "button primary", type: "submit" }, "Guardar"),
        ),
      ),
    ];
  });
}

// Pantallas
function renderTopbar() {
  const { pendingChanges, connected } = state.git;
  const isBusy = busy !== null;
  const pendingText =
    busy ??
    (pendingChanges === 0
      ? "Todo está publicado."
      : `${pendingChanges} ${pendingChanges === 1 ? "archivo" : "archivos"} sin publicar.`);

  return h(
    "header",
    { className: "topbar" },
    h(
      "h1",
      { className: "brand" },
      // Si falta el archivo, el texto alternativo se oculta y queda solo "Editor".
      h("img", { src: "/logo-white.png", alt: "Stock One", onerror: (e: Event) => (e.target as HTMLElement).remove() }),
      h("span", {}, "Editor"),
    ),
    h("p", { className: "pending" }, pendingText),
    h(
      "div",
      { className: "actions" },
      pendingChanges > 0 &&
        h("button", { className: "link", type: "button", disabled: isBusy, onclick: discard }, "Descartar cambios"),
      h("button", { className: "button", type: "button", disabled: isBusy, onclick: updateFromGitHub }, "Actualizar"),
      h("button", { className: "button", type: "button", disabled: isBusy, onclick: openPreview }, "Vista previa"),
      h(
        "button",
        { className: "button primary", type: "button", disabled: isBusy || !connected, onclick: publish },
        "Publicar",
      ),
    ),
  );
}

function renderProducts() {
  const term = search.trim().toLowerCase();
  const visible = state.products.filter((product) =>
    `${product.name} ${brandName(product.brandId)}`.toLowerCase().includes(term),
  );
  const money = new Intl.NumberFormat(state.site.locale, {
    style: "currency",
    currency: state.site.currency,
  });

  const searchInput = h("input", {
    type: "search",
    placeholder: "Buscar por modelo o marca",
    "aria-label": "Buscar por modelo o marca",
    value: search,
    oninput: (event: Event) => {
      search = (event.target as HTMLInputElement).value;
      render();
      document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    },
  });

  const content =
    state.products.length === 0
      ? h(
          "div",
          { className: "empty" },
          h("p", {}, "Aún no hay productos. Agrega el primero para que aparezca en la tienda."),
        )
      : visible.length === 0
        ? h("div", { className: "empty" }, h("p", {}, "Ningún producto coincide con esa búsqueda."))
        : h(
            "ul",
            { className: "products" },
            ...visible.map((product) => {
              const first = product.images[0];
              return h(
                "li",
                {},
                h(
                  "button",
                  { className: "product", type: "button", onclick: () => productDialog(product) },
                  first
                    ? h("img", { src: `/media/${first.id}-480.webp`, alt: "" })
                    : h("span", { className: "no-photo" }),
                  h(
                    "span",
                    {},
                    h("strong", {}, product.name),
                    h(
                      "small",
                      {},
                      `${brandName(product.brandId)}, ${money.format(product.priceCents / 100)}, ${product.stock} en existencia`,
                    ),
                  ),
                  (product.status !== "available" || product.stock === 0 || isBrandSoon(product.brandId)) &&
                    h(
                      "span",
                      { className: "tag" },
                      product.status === "hidden"
                        ? "Oculto"
                        : isBrandSoon(product.brandId)
                          ? "Marca próximamente"
                          : "Agotado",
                    ),
                ),
              );
            }),
          );

  return h(
    "section",
    {},
    h(
      "div",
      { className: "toolbar" },
      searchInput,
      h(
        "button",
        {
          className: "button primary",
          type: "button",
          // Sin marcas no se puede guardar un producto: se ofrece crear la primera.
          onclick: () =>
            state.brands.length === 0 ? brandDialog(undefined, () => productDialog()) : productDialog(),
        },
        "Agregar producto",
      ),
    ),
    content,
  );
}

function renderBrands() {
  const counts = new Map<string, number>();
  for (const product of state.products) counts.set(product.brandId, (counts.get(product.brandId) ?? 0) + 1);

  const list =
    state.brands.length === 0
      ? h(
          "div",
          { className: "empty" },
          h("p", {}, "Aún no hay marcas. Agrega la primera, por ejemplo Nike o Adidas."),
        )
      : h(
          "ul",
          { className: "products" },
          ...sortedBrands().map((brand) => {
            const count = counts.get(brand.id) ?? 0;
            return h(
              "li",
              {},
              h(
                "button",
                { className: "product brand-row", type: "button", onclick: () => brandDialog(brand) },
                h("strong", {}, brand.name, brand.comingSoon && h("span", { className: "tag soon" }, "Próximamente")),
                h("small", {}, count === 1 ? "1 producto" : `${count} productos`),
              ),
            );
          }),
        );

  return h(
    "section",
    {},
    h(
      "div",
      { className: "toolbar" },
      h("p", { className: "grow" }, "Las marcas agrupan los productos y sirven de filtro en la tienda."),
      h("button", { className: "button primary", type: "button", onclick: () => brandDialog() }, "Agregar marca"),
    ),
    list,
  );
}

function renderSettings() {
  const { site } = state;
  const input = (value: string, type = "text") => h("input", { type, required: true, value });
  const name = input(site.name);
  const tagline = input(site.tagline);
  const whatsappNumber = input(site.whatsappNumber);
  const whatsappGreeting = input(site.whatsappGreeting);
  const url = input(site.url, "url");
  const currency = input(site.currency);
  const locale = input(site.locale);

  async function save(event: SubmitEvent) {
    event.preventDefault();
    try {
      await sendJson("/api/site", "PUT", {
        name: name.value,
        tagline: tagline.value,
        url: url.value,
        whatsappNumber: whatsappNumber.value,
        whatsappGreeting: whatsappGreeting.value,
        currency: currency.value,
        locale: locale.value,
      });
      toast("Ajustes guardados.");
      await refresh();
    } catch (error) {
      toast(errorText(error), true);
    }
  }

  const field = (label: string, control: HTMLElement, hint?: string) =>
    h("label", { className: "field" }, h("span", {}, label), control, hint && h("small", {}, hint));

  return h(
    "form",
    { className: "settings", onsubmit: (event: SubmitEvent) => void save(event) },
    field("Nombre de la tienda", name),
    field("Frase de bienvenida", tagline),
    field("Número de WhatsApp", whatsappNumber, "Solo números, con el código de país. Ejemplo: 50499990000."),
    field("Saludo del mensaje", whatsappGreeting, "Es la primera línea del mensaje que recibe el vendedor."),
    field("Dirección del sitio", url, "Se usa para el enlace del producto en el mensaje."),
    h(
      "div",
      { className: "columns" },
      field("Moneda", currency, "Código de 3 letras."),
      field("Formato regional", locale),
    ),
    h("button", { className: "button primary", type: "submit" }, "Guardar ajustes"),
  );
}

function render() {
  const tab = (id: typeof view, label: string) =>
    h(
      "button",
      {
        className: "button",
        type: "button",
        role: "tab",
        "aria-selected": view === id,
        onclick: () => {
          view = id;
          render();
        },
      },
      label,
    );

  app.replaceChildren(
    renderTopbar(),
    h(
      "main",
      {},
      ...state.warnings.map((warning) => h("p", { className: "warning" }, warning)),
      noticeSlot,
      h(
        "div",
        { className: "tabs", role: "tablist" },
        tab("products", "Productos"),
        tab("brands", "Marcas"),
        tab("settings", "Ajustes"),
      ),
      view === "products" ? renderProducts() : view === "brands" ? renderBrands() : renderSettings(),
    ),
  );
}

if (!token) {
  app.append(
    h(
      "main",
      {},
      h("p", { className: "warning" }, "Abre el editor con StockOne-Editor para iniciar una sesión."),
    ),
  );
} else {
  refresh().catch((error) => {
    app.append(h("main", {}, h("p", { className: "warning" }, errorText(error))));
  });
}
