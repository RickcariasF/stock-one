"use client";

import { useMemo, useState } from "react";
import type { Brand, Product, Site } from "@/lib/schema";
import { ProductTile } from "./ProductTile";

type Props = {
  products: Product[];
  brands: Brand[];
  site: Pick<Site, "currency" | "locale">;
  /** https://wa.me/<número>, para preguntar por una marca que aún no llega. */
  whatsappBase: string;
};

/** Ignora mayúsculas y tildes: "puma" encuentra "PUMA". */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Filtro por marca y búsqueda en el navegador: la lista completa ya viene en la página. */
export function CatalogBrowser({ products, brands, site, whatsappBase }: Props) {
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState<string | null>(null);
  // En teléfono las marcas se desplazan de lado: el aviso se oculta al llegar al final.
  const [moreBrands, setMoreBrands] = useState(true);

  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);
  const selected = brands.find((b) => b.id === brandId);

  const results = useMemo(() => {
    const term = normalize(query.trim());
    return products.filter(
      (product) =>
        (!brandId || product.brandId === brandId) &&
        (!term ||
          normalize(`${brandName.get(product.brandId)} ${product.name} ${product.description}`).includes(term)),
    );
  }, [products, brandId, query, brandName]);

  const clear = () => {
    setQuery("");
    setBrandId(null);
  };

  return (
    <section aria-label="Catálogo">
      {/* Las marcas en grande son el filtro principal y la cara de la tienda. */}
      <div className="on-dark bg-ink text-paper">
        <nav aria-label="Marcas" className="mx-auto max-w-7xl px-4 sm:px-6">
          <ul
            onScroll={({ currentTarget: el }) => setMoreBrands(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)}
            className="-mx-4 flex gap-x-7 overflow-x-auto px-4 pb-5 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            <BrandButton label="Todas" active={!brandId} onClick={() => setBrandId(null)} />
            {brands.map((brand) => (
              <BrandButton
                key={brand.id}
                label={brand.name}
                active={brandId === brand.id}
                onClick={() => setBrandId(brand.id)}
              />
            ))}
          </ul>
          <p aria-hidden className={`-mt-2 pb-4 text-sm text-[#bbbbbb] sm:hidden ${moreBrands ? "" : "invisible"}`}>
            Desliza para ver más marcas →
          </p>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-soft" aria-live="polite">
            {selected?.comingSoon ? "Próximamente" : results.length === 1 ? "1 par" : `${results.length} pares`}
          </p>
          <label className="block sm:w-80">
            <span className="sr-only">Buscar por modelo o marca</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por modelo o marca"
              className="w-full rounded border border-line bg-paper px-4 py-2.5 placeholder:text-ink-soft focus:border-ink"
            />
          </label>
        </div>

        {selected?.comingSoon ? (
          <ComingSoon brand={selected.name} whatsappBase={whatsappBase} />
        ) : results.length > 0 ? (
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {results.map((product, index) => (
              <ProductTile
                key={product.id}
                product={product}
                brandName={brandName.get(product.brandId) ?? ""}
                site={site}
                priority={index < 2}
              />
            ))}
          </ul>
        ) : (
          <div className="mt-6 rounded bg-surface-light px-6 py-8">
            <p className="font-semibold">Ningún par coincide con tu búsqueda.</p>
            <button type="button" onClick={clear} className="mt-2 underline underline-offset-4">
              Ver todo el catálogo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Panel para marcas que aún no tienen productos a la venta. */
function ComingSoon({ brand, whatsappBase }: { brand: string; whatsappBase: string }) {
  const message = `Hola, me interesa saber cuándo llega ${brand}.`;
  return (
    <div className="on-dark mt-6 rounded bg-ink px-6 py-12 text-center text-paper sm:py-16" role="status">
      <p className="text-[#cccccc]">{brand}</p>
      <p className="condensed mt-1 text-[clamp(2.75rem,13vw,6rem)] leading-none font-extrabold text-gold uppercase">
        Próximamente
      </p>
      <p className="mx-auto mt-4 max-w-md text-[#dddddd]">
        Estamos preparando los modelos de esta marca. Si buscas un par en específico, escríbenos.
      </p>
      <a
        href={`${whatsappBase}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block rounded bg-action px-5 py-3 font-bold text-on-action hover:opacity-90"
      >
        Preguntar por WhatsApp
      </a>
    </div>
  );
}

function BrandButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`condensed border-b-4 pb-1 text-3xl font-extrabold uppercase transition-colors sm:text-5xl ${
          active ? "border-gold text-gold" : "border-transparent text-[#bbbbbb] hover:text-paper"
        }`}
      >
        {label}
      </button>
    </li>
  );
}
