import { IMAGE_WIDTHS, type ProductImage } from "./schema";

/** Ruta pública de una variante de la foto. */
export const imageSrc = (id: string, width: number) => `/products/${id}-${width}.webp`;

/** `srcset` para que cada dispositivo descargue solo el tamaño que necesita. */
export const imageSrcSet = (image: ProductImage) =>
  IMAGE_WIDTHS.map((width) => `${imageSrc(image.id, width)} ${width}w`).join(", ");

/** Variante principal para Open Graph y datos estructurados. */
export const largeImageSrc = (image: ProductImage) => imageSrc(image.id, IMAGE_WIDTHS[1]);
