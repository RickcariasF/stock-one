# Marca de Stock One

La fuente de verdad es [`MANUAL-DE-MARCA.md`](MANUAL-DE-MARCA.md): nombre, paleta, proporciones y
criterios visuales. Cualquier cambio de diseño debe respetarlo.

## Paleta

Los colores del manual viven en [`src/styles/theme.css`](../src/styles/theme.css), el único archivo con
colores del proyecto. El sitio y el editor los leen de ahí.

| Variable | Uso |
| --- | --- |
| `--stock-one-paper` | Fondo principal (blanco) |
| `--stock-one-ink` | Navegación, encabezados y texto principal (negro) |
| `--stock-one-ink-soft` | Texto secundario |
| `--stock-one-line` | Bordes |
| `--stock-one-tint-1` a `--stock-one-tint-4` | Fondos de etiquetas, avisos y superficies |
| `--stock-one-action` | Acción principal (dorado) |
| `--stock-one-on-action` | Texto sobre el dorado |
| `--stock-one-focus` | Anillo de foco del teclado (morado) |
| `--stock-one-danger` | Errores y acciones destructivas |
| `--stock-one-black`, `-gold`, `-white`, `-purple` | Colores de marca |
| `--stock-one-text-muted` | Información auxiliar, solo en texto grande |
| `--stock-one-surface-dark`, `-surface-light` | Superficies; la clara es el fondo de las fotos |

### Reglas de contraste (mínimo 4.5:1)

| Combinación | Contraste | Uso |
| --- | --- | --- |
| Negro sobre blanco | 18.9:1 | Texto principal |
| `#555555` sobre blanco | 7.5:1 | Texto secundario |
| Negro sobre dorado | 7.1:1 | Botón principal |
| Dorado sobre negro | 7.1:1 | Precio destacado y marca activa |
| Morado sobre morado suave | 6.6:1 | Etiqueta Agotado |
| Dorado sobre blanco | 2.7:1 | No usar para texto |
| `#777777` sobre blanco | 4.48:1 | Solo texto grande |

`themeColor` en `src/app/layout.tsx` debe coincidir con `--stock-one-paper` (`#FFFFFF`).

## Tipografía

Archivo, una sola familia: ancho condensado y peso extra negrita para el nombre de la tienda, las
marcas y los títulos; ancho normal para el resto.

## Logotipo

Los originales (1000 × 1000 px, fondo transparente) están en esta carpeta y no se editan:

| Original | Uso |
| --- | --- |
| `stock-one-logo-negro.png` | Corona dorada y texto negro, para fondos claros |
| `stock-one-logo-blanco.png` | Corona dorada y texto blanco, para fondos oscuros |

A partir de ellos se generan, sin cambiar colores ni proporciones:

| Archivo | Qué es | Dónde se ve |
| --- | --- | --- |
| `public/brand/logo-white.png` | Logo blanco sin margen | Barra, portada y editor (fondos negros) |
| `public/brand/logo.png` | Logo negro sin margen | Fondos claros |
| `src/app/icon.png` | Corona sola, 512 × 512 | Pestaña del navegador |
| `src/app/apple-icon.png` | Corona sobre negro, 180 × 180 | Acceso directo en iPhone |
| `src/app/opengraph-image.png` | Logo sobre blanco, 1200 × 630 | Vista previa al compartir el sitio |

Si el logo cambia, reemplaza los originales y vuelve a generar estos archivos. Si falta
`public/brand/logo-white.png`, el sitio muestra "Stock One" como texto.

Los logotipos y colores de las marcas que se venden (Nike, Adidas...) no se alteran.
