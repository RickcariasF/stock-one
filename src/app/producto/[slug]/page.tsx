import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatIcon } from "@/components/ChatIcon";
import { Gallery } from "@/components/Gallery";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getBrand, getProduct, getVisibleProducts, site } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { largeImageSrc } from "@/lib/images";
import { isSoldOut, type Brand, type Product } from "@/lib/schema";
import { fullName, productMessage, productUrl, whatsappUrl } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

// Una página HTML por producto, generada al compilar.
export const dynamicParams = false;
export const generateStaticParams = () => getVisibleProducts().map(({ id }) => ({ slug: id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProduct((await params).slug);
  if (!product) return {};
  const image = product.images[0];
  const title = fullName(product, getBrand(product.brandId));
  return {
    title,
    description: product.description.slice(0, 160),
    alternates: { canonical: `/producto/${product.id}/` },
    openGraph: {
      title,
      description: product.description.slice(0, 160),
      images: image ? [largeImageSrc(image)] : undefined,
    },
  };
}

/** Datos estructurados para buscadores. Escapa `<` para que el texto no cierre la etiqueta script. */
function jsonLd(product: Product, brand: Brand) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: fullName(product, brand),
    brand: { "@type": "Brand", name: brand.name },
    description: product.description,
    image: product.images.map((image) => new URL(largeImageSrc(image), site.url).href),
    offers: {
      "@type": "Offer",
      url: productUrl(product, site),
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: site.currency,
      availability:
        !isSoldOut(product)
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default async function ProductPage({ params }: Props) {
  const product = getProduct((await params).slug);
  if (!product) notFound();

  const brand = getBrand(product.brandId);
  const soldOut = isSoldOut(product);
  const message = soldOut
    ? `Hola, ¿cuándo vuelve a estar disponible este producto?\n${fullName(product, brand)}\n${productUrl(product, site)}`
    : productMessage(product, brand, site);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pt-2 sm:px-6 lg:grid-cols-2 lg:gap-14">
        <Gallery images={product.images} name={product.name} />

        <div className="lg:pt-4">
          <Link href="/" className="underline underline-offset-4">
            Volver al catálogo
          </Link>
          <p className="mt-6 text-ink-soft">{brand.name}</p>
          <h1 className="condensed mt-1 text-5xl leading-[0.95] font-extrabold text-balance uppercase sm:text-6xl">
            {product.name}
          </h1>
          {/* Precio destacado: dorado sobre negro, donde el dorado sí alcanza el contraste. */}
          <p className="mt-5 inline-block rounded bg-ink px-3 py-1.5 text-2xl font-bold text-gold tabular-nums">
            {formatPrice(product.priceCents, site)}
          </p>
          {soldOut && (
            <p className="mt-3">
              <span className="rounded bg-tint-2 px-2.5 py-1 font-semibold text-purple">Agotado por ahora</span>
            </p>
          )}
          {/* Texto plano: conserva saltos de línea y nunca se interpreta como HTML. */}
          <p className="mt-5 max-w-prose whitespace-pre-line">{product.description}</p>

          <div className="mt-8 max-w-md">
            <p className="text-ink-soft">Este mensaje se abrirá en WhatsApp para que lo envíes:</p>
            <p className="mt-2 rounded border-l-4 border-gold bg-surface-light px-5 py-3 whitespace-pre-line wrap-anywhere">
              {message}
            </p>
            <a
              href={whatsappUrl(site, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 rounded bg-action px-6 py-4 text-lg font-bold text-on-action hover:opacity-90"
            >
              <ChatIcon className="size-6" />
              {soldOut ? "Preguntar por disponibilidad" : "Pedir por WhatsApp"}
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(product, brand) }} />
    </>
  );
}
