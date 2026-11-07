import Link from "next/link";
import { site } from "@/lib/catalog";
import { getLogo, LOGO_SIZE } from "@/lib/brand";
import { whatsappUrl } from "@/lib/whatsapp";
import { ChatIcon } from "./ChatIcon";

/** Barra negra. En la portada el nombre vive en el hero, así que aquí solo aparece en el resto. */
export function SiteHeader({ showName = true }: { showName?: boolean }) {
  const logo = getLogo("onDark");
  return (
    <header className="on-dark bg-ink text-paper">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        {showName ? (
          <Link href="/" className="condensed text-2xl font-extrabold uppercase">
            {logo ? (
              <img src={logo} alt={site.name} width={LOGO_SIZE.width} height={LOGO_SIZE.height} className="h-14 w-auto" />
            ) : (
              site.name
            )}
          </Link>
        ) : (
          <span />
        )}
        <a
          href={whatsappUrl(site, `Hola, tengo una consulta sobre ${site.name}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded border border-paper/60 px-4 py-2 font-semibold hover:border-gold hover:text-gold"
        >
          <ChatIcon />
          Escríbenos
        </a>
      </div>
    </header>
  );
}
