# Seguridad

Stock One reduce el riesgo quitando piezas: en producción no hay servidor propio, login, base de datos ni
datos de clientes. Lo que queda por proteger es la integridad del sitio publicado.

## Amenazas y defensas

| Amenaza | Defensa |
| --- | --- |
| Inyección de scripts (XSS) | Textos planos que React escapa, sin HTML en el catálogo. CSP con la huella exacta de cada script en línea por página |
| Clickjacking | `frame-ancestors 'none'` y `X-Frame-Options: DENY` |
| Degradación a HTTP | HTTPS de Cloudflare y HSTS |
| Otra página ataca el editor local (CSRF) | Token aleatorio por sesión en una cabecera propia, verificación de `Origin` y `Sec-Fetch-Site`, y sin CORS |
| DNS rebinding contra el editor | Solo se acepta `Host: 127.0.0.1:4555` |
| Acceso al editor desde la red | Escucha únicamente en `127.0.0.1` |
| Archivo malicioso subido como foto | Formato detectado por contenido, SVG rechazado, límites de bytes y píxeles, y recodificación a WebP |
| Fuga de ubicación en fotos | La recodificación elimina EXIF y GPS |
| Recorrido de rutas | Los ids de archivo los genera el servidor y se validan con patrones estrictos |
| Inyección de comandos | Git se ejecuta sin shell y con argumentos fijos |
| Datos inválidos en producción | El mismo esquema valida al guardar, al publicar y al compilar, incluida la marca de cada producto. Si falla, el sitio anterior sigue en línea |
| Paquete comprometido | Lockfile congelado, 3 días de espera tras cada versión, y ningún script de instalación permitido |
| Acción de GitHub comprometida | Acciones fijadas por hash de commit y `persist-credentials: false` |
| Robo del token de Cloudflare | Token con un solo permiso, en un entorno limitado a `main`. El job que lo usa no compila el proyecto |
| Secretos en el código | `.gitignore` y Push protection de GitHub |

## Riesgos aceptados

- **El editor tiene permiso de escritura en todo el repositorio.** El editor local solo publica las
  carpetas de contenido, pero la cuenta de GitHub podría cambiar el código por otra vía. Protege esa
  cuenta con autenticación de dos factores.
- **El editor confía en su computadora.** Un equipo con malware podría usar la sesión de GitHub. El
  daño se limita al repositorio y se revierte con Git.
- **La CSP del encabezado incluye `'unsafe-inline'`.** Es necesario para que funcione la lista de huellas
  en el `<meta>` de cada página. El navegador aplica ambas políticas, y la compilación agrega ese `<meta>`
  a cada HTML. Un error de esa etapa detiene el despliegue.
- **El número de WhatsApp es público.** Es inherente al modelo de venta.
- **Sin límite de peticiones propio.** Lo cubre la protección contra DDoS de Cloudflare.

## Mantenimiento

- Revisa cada semana los pull requests de Dependabot. CI los valida antes de fusionarlos.
- Si GitHub alerta de un secreto expuesto, revoca el token en Cloudflare y crea otro.
- El flujo **Seguridad** audita las dependencias cada lunes.

## Verificación

Tras el primer despliegue, revisa la dirección pública en [Security Headers](https://securityheaders.com)
y en [Mozilla HTTP Observatory](https://developer.mozilla.org/observatory).
