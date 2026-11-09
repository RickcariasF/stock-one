import { site } from "@/lib/catalog";
import { getLogo, LOGO_SIZE } from "@/lib/brand";

/**
 * Portada sobre negro: el logotipo y la frase de bienvenida, que llega como un mensaje
 * de WhatsApp que se está escribiendo. Es la única animación automática del sitio.
 */
export function Hero() {
  const logo = getLogo("onDark");
  return (
    <section className="mx-auto max-w-7xl px-4 pt-4 pb-10 sm:px-6 md:pt-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-10">
        {/* En teléfono el logo va centrado; desde md vuelve a alinearse con la fila */}
        <h1 className={logo ? "shrink-0 self-center md:self-auto" : "condensed text-[clamp(4.5rem,19vw,15rem)] leading-[0.82] font-extrabold uppercase"}>
          {logo ? (
            <img
              src={logo}
              alt={site.name}
              width={LOGO_SIZE.width}
              height={LOGO_SIZE.height}
              className="h-[clamp(11rem,34vw,19rem)] w-auto"
            />
          ) : (
            site.name
          )}
        </h1>

        <div className="md:pb-3">
          <p className="mb-2 text-sm text-[#bbbbbb]">{site.name} te escribe</p>
          <div className="bubble-in relative max-w-xl bg-tint-1 px-6 py-4 text-ink">
            <div className="hero-dots absolute top-1/2 left-6 flex -translate-y-1/2 gap-1.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-ink" />
              <span className="size-2.5 rounded-full bg-ink" />
              <span className="size-2.5 rounded-full bg-ink" />
            </div>
            <p className="hero-message condensed text-2xl leading-tight font-bold sm:text-4xl">{site.tagline}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
