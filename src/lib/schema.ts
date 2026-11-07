// Contrato de datos del catálogo. Lo usan el sitio (al compilar) y el editor (al guardar),
// así que un dato inválido no puede llegar a producción por ninguna de las dos vías.
import { z } from "zod";

/** Anchos que genera el editor para cada foto; el sitio los usa en `srcset`. */
export const IMAGE_WIDTHS = [480, 1200] as const;

/** Número de relleno: mientras siga aquí, el editor avisa que falta configurarlo. */
export const PLACEHOLDER_WHATSAPP = "50400000000";
/** URL de relleno: `.example` es un dominio reservado que nunca existirá. */
export const PLACEHOLDER_URL = "https://stock-one.example";

/** Detecta direcciones de relleno: cualquier dominio `.example`. */
export function isPlaceholderUrl(value: string): boolean {
  return new URL(value).hostname.endsWith(".example");
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Caracteres de control: no aportan nada a un texto y pueden alterar su presentación.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Compara nombres sin mayúsculas, tildes ni espacios extra: "Adidas" y " adidas " son la misma marca. */
export const normalizeName = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Texto plano. React lo escapa al mostrarlo; nunca se interpreta como HTML. */
const plainText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}: este campo es obligatorio.`)
    .max(max, `${label}: usa ${max} caracteres o menos.`)
    .refine((value) => !CONTROL_CHARS.test(value), `${label}: contiene caracteres no válidos.`);

export const imageSchema = z.object({
  // El editor genera este id; nunca viene del nombre del archivo subido.
  id: z.string().regex(SLUG, "Identificador de imagen no válido.").max(100),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Marcas: reemplazan a las categorías. El id es estable aunque cambie el nombre.
export const brandInputSchema = z.object({
  name: plainText("Marca", 40),
  // Próximamente: la marca aparece en la tienda, pero sus productos quedan ocultos.
  comingSoon: z.boolean().default(false),
});

export const brandSchema = brandInputSchema.extend({
  id: z.string().regex(SLUG, "Identificador de marca no válido.").max(60),
});

export const brandsSchema = z
  .array(brandSchema)
  .refine((brands) => new Set(brands.map((b) => b.id)).size === brands.length, "Hay marcas con el mismo identificador.")
  .refine(
    (brands) => new Set(brands.map((b) => normalizeName(b.name))).size === brands.length,
    "Hay marcas con el mismo nombre.",
  );

export const productStatusSchema = z.enum(["available", "sold_out", "hidden"]);

export const productInputSchema = z.object({
  name: plainText("Nombre", 120),
  description: plainText("Descripción", 2000),
  // Se guarda en centavos para evitar errores de redondeo con decimales.
  priceCents: z
    .number("Precio: escribe un número.")
    .int("Precio: revisa los decimales.")
    .min(0, "Precio: no puede ser negativo.")
    .max(1_000_000_000, "Precio: el valor es demasiado alto."),
  brandId: z.string().regex(SLUG, "Marca: elige una marca.").max(60),
  images: z.array(imageSchema).max(8, "Fotos: usa 8 o menos por producto."),
  // Existencias. En 0 el producto se muestra como agotado. Catálogos antiguos sin este dato valen 1.
  stock: z
    .number("Existencias: escribe un número.")
    .int("Existencias: usa un número entero.")
    .min(0, "Existencias: no pueden ser negativas.")
    .max(100_000, "Existencias: el valor es demasiado alto.")
    .default(1),
  status: productStatusSchema,
  featured: z.boolean(),
});

export const productSchema = productInputSchema.extend({
  // También es la dirección pública: no cambia al renombrar el producto.
  id: z.string().regex(SLUG, "Identificador de producto no válido.").max(80),
});

export const catalogSchema = z
  .array(productSchema)
  .refine(
    (products) => new Set(products.map((p) => p.id)).size === products.length,
    "Hay productos con el mismo identificador.",
  );

export const siteSchema = z.object({
  name: plainText("Nombre de la tienda", 60),
  tagline: plainText("Frase de bienvenida", 160),
  url: z
    .url("Dirección del sitio: escribe una dirección completa.")
    .refine(
      (value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      },
      "Dirección del sitio: debe empezar con https://.",
    ),
  // Solo dígitos con código de país; es el formato que exige wa.me.
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^[1-9]\d{7,14}$/, "WhatsApp: escribe solo números, con el código de país."),
  whatsappGreeting: plainText("Saludo de WhatsApp", 160),
  currency: z.string().regex(/^[A-Z]{3}$/, "Moneda: usa el código de 3 letras, como HNL."),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Formato regional: usa algo como es-HN."),
});

/** Cada producto debe apuntar a una marca existente. Lo usan la compilación, el editor y CI. */
export function findMissingBrand(products: Pick<Product, "name" | "brandId">[], brands: Pick<Brand, "id">[]) {
  const ids = new Set(brands.map((brand) => brand.id));
  return products.find((product) => !ids.has(product.brandId));
}

/** Agotado por decisión del operador o por quedarse sin existencias. */
export const isSoldOut = (product: Pick<Product, "status" | "stock">) =>
  product.status === "sold_out" || product.stock === 0;

export type BrandInput = z.infer<typeof brandInputSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type ProductImage = z.infer<typeof imageSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type Product = z.infer<typeof productSchema>;
export type Site = z.infer<typeof siteSchema>;
