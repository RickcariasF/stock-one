"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { ProductImage as Image } from "@/lib/schema";
import { ProductImage } from "./ProductImage";

/**
 * Carrusel de fotos del producto. Usa el desplazamiento nativo con "snap": en el celular se
 * desliza con el dedo, y en escritorio con flechas, miniaturas o el teclado. Con una sola foto
 * se muestra fija, sin controles.
 */
export function Gallery({ images, name }: { images: Image[]; name: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const total = images.length;

  if (total <= 1) {
    return (
      <ProductImage
        image={images[0]}
        alt={name}
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
        className="aspect-square w-full rounded bg-surface-light object-contain"
      />
    );
  }

  const goTo = (index: number) => {
    const el = track.current;
    if (!el) return;
    const next = (index + total) % total;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  // La foto actual sale de la posición del desplazamiento, así deslizar y pulsar quedan sincronizados.
  const onScroll = () => {
    const el = track.current;
    // Durante un cambio de tamaño el ancho puede ser 0; se ignora para no calcular NaN.
    if (el && el.clientWidth > 0) setCurrent(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") goTo(current + 1);
    if (event.key === "ArrowLeft") goTo(current - 1);
  };

  return (
    <div role="region" aria-roledescription="carrusel" aria-label={`Fotos de ${name}`}>
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          tabIndex={0}
          className="flex snap-x snap-mandatory overflow-x-auto rounded bg-surface-light [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              className="w-full shrink-0 snap-center"
              role="group"
              aria-roledescription="foto"
              aria-label={`${index + 1} de ${total}`}
            >
              <ProductImage
                image={image}
                alt={index === 0 ? name : `${name}, foto ${index + 1}`}
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority={index === 0}
                className="aspect-square w-full object-contain"
              />
            </div>
          ))}
        </div>
        <ArrowButton direction="prev" onClick={() => goTo(current - 1)} />
        <ArrowButton direction="next" onClick={() => goTo(current + 1)} />
        <p className="absolute right-3 bottom-3 rounded bg-ink px-2.5 py-1 text-sm font-semibold text-paper tabular-nums">
          {current + 1} / {total}
        </p>
      </div>

      <ul className="mt-3 flex gap-2 overflow-x-auto">
        {images.map((image, index) => (
          <li key={image.id} className="shrink-0">
            <button
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Ver foto ${index + 1} de ${total}`}
              aria-current={index === current}
              className={`block overflow-hidden rounded border-2 ${
                index === current ? "border-ink" : "border-transparent"
              }`}
            >
              <ProductImage image={image} alt="" sizes="80px" className="size-16 bg-surface-light object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArrowButton({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  const prev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={prev ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-paper/90 text-ink shadow-sm hover:bg-paper ${
        prev ? "left-3" : "right-3"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d={prev ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}
