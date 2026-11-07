import { imageSrc, imageSrcSet } from "@/lib/images";
import { IMAGE_WIDTHS, type ProductImage as Image } from "@/lib/schema";

type Props = {
  image: Image | undefined;
  alt: string;
  sizes: string;
  className?: string;
  /** La imagen principal de una página carga de inmediato. */
  priority?: boolean;
};

/** `<img>` nativo: las fotos ya vienen en WebP y en dos tamaños desde el editor. */
export function ProductImage({ image, alt, sizes, className, priority = false }: Props) {
  if (!image) {
    return (
      <div className={`grid place-items-center bg-surface-light text-ink-soft ${className ?? ""}`}>
        <span>Sin foto</span>
      </div>
    );
  }
  return (
    <img
      src={imageSrc(image.id, IMAGE_WIDTHS[0])}
      srcSet={imageSrcSet(image)}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
    />
  );
}
