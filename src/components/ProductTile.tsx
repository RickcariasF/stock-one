import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { isSoldOut, type Product, type Site } from "@/lib/schema";
import { ProductImage } from "./ProductImage";

type Props = {
  product: Product;
  brandName: string;
  site: Pick<Site, "currency" | "locale">;
  priority?: boolean;
};

/** Tarjeta limpia: la foto del par es la protagonista, sin sombras ni adornos. */
export function ProductTile({ product, brandName, site, priority }: Props) {
  const soldOut = isSoldOut(product);
  const large = product.featured;
  return (
    <li className={large ? "col-span-2" : undefined}>
      <Link href={`/producto/${product.id}/`} className="group flex h-full flex-col">
        {/* En escritorio el destacado se estira para igualar la altura de su fila. */}
        <div
          className={`relative overflow-hidden rounded bg-surface-light ${
            large ? "aspect-[8/5] lg:aspect-auto lg:min-h-72 lg:flex-1" : "aspect-square"
          }`}
        >
          <ProductImage
            image={product.images[0]}
            alt=""
            sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
            priority={priority}
            className={`absolute inset-0 size-full object-contain ${soldOut ? "opacity-50 grayscale" : ""}`}
          />
          {soldOut && (
            <span className="absolute top-3 left-3 rounded bg-tint-2 px-2.5 py-1 text-sm font-semibold text-purple">
              Agotado
            </span>
          )}
        </div>
        {/* Marca, modelo y precio siempre en el mismo orden, sin importar el largo del nombre. */}
        <div className="pt-3">
          <p className="text-sm text-ink-soft">{brandName}</p>
          <h3 className="leading-snug font-semibold underline-offset-4 group-hover:underline">{product.name}</h3>
          <p className="mt-1 font-bold tabular-nums">{formatPrice(product.priceCents, site)}</p>
        </div>
      </Link>
    </li>
  );
}
