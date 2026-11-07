/** Convierte lo que escribe la persona ("1,250.50" o "L 80") en centavos, o `null` si no es válido. */
export function parsePrice(text: string): number | null {
  const clean = text.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Valor del campo de precio al editar un producto existente. */
export const priceToText = (cents: number) => (cents / 100).toFixed(2);
