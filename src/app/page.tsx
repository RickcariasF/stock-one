import { CatalogBrowser } from "@/components/CatalogBrowser";
import { Hero } from "@/components/Hero";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getRailBrands, getVisibleProducts, site } from "@/lib/catalog";
import { whatsappUrl } from "@/lib/whatsapp";

export default function HomePage() {
  const products = getVisibleProducts();
  return (
    <>
      <SiteHeader showName={false} />
      <main>
        <div className="on-dark bg-ink text-paper">
          <Hero />
        </div>
        <CatalogBrowser
          products={products}
          brands={getRailBrands(products)}
          site={{ currency: site.currency, locale: site.locale }}
          // Enlace base; el mensaje con la marca lo arma el navegador.
          whatsappBase={whatsappUrl(site)}
        />
      </main>
      <SiteFooter />
    </>
  );
}
