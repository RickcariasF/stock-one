# Stock One --- Instrucciones de actualización del proyecto

## Objetivo

El proyecto anteriormente llamado **YKZ** ahora se llama **Stock One**.
Actualiza el nombre en todo el repositorio: interfaz, código,
configuración, estilos, metadatos y documentación. Conserva el
funcionamiento actual y evita refactors que no sean necesarios para esta
migración.

## Identidad de marca

-   Nombre oficial: **Stock One**
-   Identificador técnico sugerido: `stock-one`
-   Prefijo sugerido para variables CSS: `--stock-one-`

Stock One es un catálogo online estático dedicado a la exhibición y
venta de zapatos y sneakers de diferentes marcas. Su identidad debe ser
urbana, moderna, minimalista y premium.

## Paleta oficial

  Color    Código      Función
  -------- ----------- ----------------
  Negro    `#111111`   Principal
  Dorado   `#BC9C22`   Secundario
  Blanco   `#FFFFFF`   Secundario
  Morado   `#65428A`   Complementario

Colores de apoyo:

  Nombre         Código      Uso
  -------------- ----------- ------------------------
  Gris oscuro    `#333333`   Texto secundario
  Gris medio     `#777777`   Información auxiliar
  Gris claro     `#EEEEEE`   Bordes
  Dorado suave   `#F5EED5`   Fondos de etiquetas
  Morado suave   `#F0EAF6`   Fondos complementarios
  Blanco humo    `#F8F8F8`   Superficies
  Rojo           `#B42336`   Errores

Proporción orientativa: 55 % negro, 25 % blanco, 15 % dorado y 5 %
morado. El negro y el blanco estructuran la interfaz; el dorado aporta
acentos premium y el morado se usa con moderación.

## 1. Buscar y reemplazar el nombre anterior

Busca en todo el repositorio las variantes `YKZ`, `ykz`, `Ykz` y
`--ykz-`.

Actualiza las referencias que pertenezcan a la marca en:

-   Textos visibles, encabezados, navegación y mensajes.
-   Títulos, descripción y metadatos SEO.
-   Open Graph y metadatos para compartir.
-   `manifest`, nombre corto de la aplicación y `themeColor`.
-   `src/app/layout.tsx`.
-   Variables CSS, clases, identificadores y constantes que incluyan el
    nombre anterior.
-   Rutas y nombres de recursos específicos de la marca.
-   README, documentación y comentarios.
-   Fallback de texto que actualmente muestra el nombre cuando no existe
    logotipo.
-   Configuración PWA, favicon e iconos, si existen.
-   `package.json`, solo si el nombre del paquete corresponde al nombre
    del proyecto y el cambio no rompe integraciones.

No cambies nombres de dependencias, paquetes externos, APIs, dominios ni
identificadores de terceros que no pertenezcan a la marca.

## 2. Actualizar las variables CSS

Si las variables actuales usan el prefijo `--ykz-`, migra sus nombres al
prefijo `--stock-one-` en todos los archivos del proyecto. Usa esta base
en `src/styles/theme.css`:

``` css
:root {
  /* Base */
  --stock-one-paper: #FFFFFF;
  --stock-one-ink: #111111;
  --stock-one-ink-soft: #555555;
  --stock-one-line: #E5E5E5;

  /* Tintes de interfaz */
  --stock-one-tint-1: #F5EED5;
  --stock-one-tint-2: #F0EAF6;
  --stock-one-tint-3: #F5F5F5;
  --stock-one-tint-4: #FFF8E5;

  /* Acciones */
  --stock-one-action: #BC9C22;
  --stock-one-on-action: #111111;
  --stock-one-focus: #65428A;
  --stock-one-danger: #B42336;

  /* Colores de marca */
  --stock-one-black: #111111;
  --stock-one-gold: #BC9C22;
  --stock-one-white: #FFFFFF;
  --stock-one-purple: #65428A;

  /* Superficies y texto auxiliar */
  --stock-one-text-muted: #777777;
  --stock-one-surface-dark: #1A1A1A;
  --stock-one-surface-light: #F8F8F8;
}
```

Actualiza todas las referencias a las variables antiguas. No dejes
referencias `--ykz-*` residuales. Comprueba que todas las variables
utilizadas estén definidas.

## 3. Logotipo y recursos

El logotipo de Stock One sigue pendiente:

-   No inventes ni generes un logotipo definitivo.
-   Mientras no exista, muestra `Stock One` como texto.
-   Si existe `public/brand/`, conserva la estructura.
-   Deja preparado el destino futuro `public/brand/logo.png`.
-   El icono del sitio podrá incorporarse en `src/app/icon.png` (mínimo
    512 × 512 px).
-   No elimines recursos sin comprobar sus referencias.

## 4. Criterios visuales

-   Blanco como fondo principal.
-   Negro para navegación, encabezados y textos principales.
-   Dorado para la acción principal, precios destacados y acentos.
-   Morado para detalles secundarios y estados de foco.
-   Tarjetas limpias y fotografías de sneakers como protagonistas.
-   Evita degradados multicolor, sombras excesivas y elementos
    recargados.
-   No alteres los logotipos ni los colores originales de las marcas
    exhibidas.
-   Mantén un contraste mínimo de 4.5:1 para texto normal.

## 5. Compatibilidad

-   Conserva rutas, funcionalidades, datos y comportamiento.
-   No cambies estructuras de datos solo por cambiar el nombre.
-   Si hay claves persistentes (`localStorage`, IndexedDB o cachés) que
    contienen `ykz`, evalúa su migración sin provocar pérdida de datos.
    Mantén compatibilidad cuando sea necesario.
-   No cambies automáticamente dominios, URLs externas ni integraciones.
    Informa si requieren una decisión adicional.

## 6. Verificación obligatoria

Al terminar:

1.  Busca otra vez `YKZ`, `ykz`, `Ykz` y `--ykz-` en todo el
    repositorio.
2.  Confirma que no quedan referencias antiguas que deban actualizarse.
    Documenta las excepciones intencionales.
3.  Comprueba que todas las variables CSS utilizadas estén definidas.
4.  Verifica que `themeColor` coincida con el fondo principal:
    `#FFFFFF`.
5.  Ejecuta las comprobaciones disponibles: lint, typecheck y build.
6.  Corrige los errores introducidos por la migración.
7.  Entrega un resumen de archivos modificados, cambios realizados y
    verificaciones ejecutadas.

## Resultado esperado

Todo el proyecto debe presentarse consistentemente como **Stock One** en
la interfaz, metadatos, estilos y documentación. El código debe seguir
funcionando como antes y utilizar la nueva identidad visual. No des por
terminado el trabajo sin revisar las referencias al nombre anterior en
todo el repositorio.
