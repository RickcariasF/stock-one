# Puesta en marcha

Pasos para dejar Stock One en producción con costo cero. Solo se hacen una vez.

## 1. Probar en local

En Windows con WSL2, el proyecto vive dentro de Ubuntu (`~/labs/stock-one`), donde los archivos son mucho
más rápidos que en `/mnt/c`. Desde Ubuntu, este script verifica e instala lo necesario:

```bash
bash scripts/setup-wsl.sh   # instala Node y pnpm, y valida el proyecto
```

```bash
pnpm install   # instala las dependencias exactas del lockfile
pnpm dev       # abre el sitio en http://127.0.0.1:3000
pnpm editor    # abre el editor de catálogo
pnpm check     # corre tipos, lint y pruebas
```

`pnpm build` seguido de `pnpm preview` sirve la versión final con las mismas cabeceras de Cloudflare.

## 2. Crear el repositorio

Crea en GitHub un repositorio vacío llamado `stock-one` y sube el proyecto:

```powershell
git init --initial-branch=main                     # crea el repositorio local
git add .                                          # prepara todos los archivos
git commit -m "feat: catálogo inicial de Stock One"  # guarda la primera versión
git remote add origin git@github.com:RickcariasF/stock-one.git  # conecta con GitHub por SSH
git push -u origin main                            # sube el código
```

El primer push fallará en el paso de despliegue hasta completar la sección 3. Es lo esperado.

Un repositorio público da gratis el escaneo de secretos y sirve como portafolio. Todo lo que
contiene ya es público en el sitio, incluido el número de WhatsApp.

En **Settings** del repositorio:

1. **Advanced Security**: activa Dependabot alerts, Dependabot security updates, Secret scanning y
   Push protection.
2. **Rules > Rulesets**: crea una regla para `main` que bloquee force push y borrado. No exijas pull
   request, porque el botón Publicar envía directo a `main`.
3. **Actions > General**: en Workflow permissions deja **Read repository contents**.

## 3. Conectar Cloudflare

1. Crea una cuenta gratis y abre **Workers & Pages** una vez para registrar tu subdominio
   `<nombre>.workers.dev`.
2. En **My Profile > API Tokens** crea un token personalizado con un solo permiso:
   `Account > Workers Scripts > Edit`, limitado a tu cuenta. No uses la Global API Key.
3. Copia el **Account ID** de la página principal de tu cuenta.
4. En GitHub, ve a **Settings > Environments**, crea `production` y limita sus ramas a `main`.
5. Dentro del entorno agrega los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
6. En **Actions**, vuelve a ejecutar el flujo **CI/CD**.

El sitio queda en `https://stock-one.<nombre>.workers.dev`. Ese prefijo sale de `name` en
`wrangler.jsonc`: cambiarlo después de desplegar crea un sitio nuevo en otra dirección.

## 4. Completar los datos de la tienda

Abre el editor, entra a **Ajustes**, escribe el número de WhatsApp y la dirección del sitio, y publica.
Ambos valores vienen de relleno, y sin ellos los botones de pedido no funcionan.

## 5. Preparar la computadora del editor

1. En **Settings > Collaborators**, invita a tu amigo con permiso **Write**.
2. Pásale `scripts/instalar-stock-one.bat`. Instala lo necesario, descarga el proyecto y le pide iniciar
   sesión en GitHub en el navegador.

Git guarda esa sesión en el Administrador de credenciales de Windows, así que no maneja tokens. Su
computadora solo necesita acceso a GitHub: las credenciales de Cloudflare nunca salen de GitHub.

## Dominio

| Opción | Costo | Valoración |
| --- | --- | --- |
| `stock-one.<nombre>.workers.dev` | Gratis | Estable y con HTTPS. El punto de partida |
| `.us.kg`, `.dpdns.org` (DigitalPlat) | Gratis | Funcionan, pero dependen de un tercero que puede retirarlos y estos sufijos suelen abusarse para spam |
| `.is-a.dev` | Gratis | Pensado para sitios personales de desarrolladores, no para una tienda |
| `.eu.org` | Gratis | Serio, pero la aprobación puede tardar meses |
| `.com` o `.shop` en Cloudflare Registrar | Unos USD 10 al año | Lo recomendable cuando la tienda sea real: el dominio queda a nombre de tu amigo |

El DNS sí es gratis de verdad en Cloudflare. Lo que no suele ser confiable es el dominio gratis.

Para conectar un dominio propio, usa **Workers & Pages > (tu Worker) > Settings > Domains & Routes** y luego
actualiza la dirección del sitio en **Ajustes**.

## Revertir una publicación

```powershell
pnpm exec wrangler rollback    # vuelve a la versión anterior en Cloudflare
```

Después corrige el contenido y publica de nuevo, porque el siguiente despliegue usa lo que haya en `main`.
