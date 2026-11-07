#!/usr/bin/env bash
# Prepara el entorno de desarrollo de Stock One en Ubuntu sobre WSL2.
# Se puede repetir sin riesgo: solo instala lo que falta y nunca sobrescribe el proyecto.
#
# Uso:  bash "/mnt/c/ruta/al/proyecto/scripts/setup-wsl.sh"
set -euo pipefail

ORIGEN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINO="${STOCK_ONE_DESTINO:-$HOME/labs/stock-one}"
REGISTRO="$ORIGEN/setup-wsl.log"
NVM_VERSION="v0.40.8" # Versión fija: se descarga exactamente esta etiqueta.
NODE_MAJOR="$(tr -d '[:space:]' < "$ORIGEN/.nvmrc")"
PNPM_VERSION="$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' "$ORIGEN/package.json")"

# Muestra el avance y lo guarda para poder revisarlo después.
exec > >(tee "$REGISTRO") 2>&1
trap 'codigo=$?; [[ $codigo -eq 0 ]] || echo "RESULTADO: FALLÓ. Revisa el último paso de arriba."' EXIT

paso() { printf '\n== %s\n' "$1"; }

# WSL hereda el PATH de Windows: un node.exe en /mnt/c no sirve dentro de Linux.
comando_linux() {
  local ruta
  ruta="$(command -v "$1" 2>/dev/null)" || return 1
  [[ "$ruta" != /mnt/* ]]
}

# nvm no es compatible con `set -eu`; se desactiva solo mientras se ejecuta.
nvm_seguro() {
  set +eu
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  if [[ $# -gt 0 ]]; then "$@"; fi
  local codigo=$?
  set -eu
  return "$codigo"
}

# Node sirve si es Linux, de la versión del proyecto y permite instalar pnpm sin sudo.
node_valido() {
  comando_linux node &&
    [[ "$(node -p 'process.versions.node.split(".")[0]')" == "$NODE_MAJOR" ]] &&
    [[ -w "$(npm prefix --global)" ]]
}

# Trabaja fuera del proyecto para que pnpm no cambie de versión al consultarla.
cd "$HOME"

paso "Sistema"
grep -i pretty_name /etc/os-release
if grep -qi microsoft /proc/sys/kernel/osrelease; then
  echo "WSL: sí"
else
  echo "Aviso: este equipo no parece ser WSL."
fi
if [[ $EUID -eq 0 ]]; then
  echo "Ejecuta el script con tu usuario normal, no como root."
  exit 1
fi
if [[ "$DESTINO" == /mnt/* ]]; then
  echo "El destino debe estar dentro de Linux, no en /mnt."
  exit 1
fi

paso "Paquetes del sistema"
faltantes=()
for paquete in git curl ca-certificates; do
  dpkg -s "$paquete" > /dev/null 2>&1 || faltantes+=("$paquete")
done
if [[ ${#faltantes[@]} -gt 0 ]]; then
  echo "Instalando: ${faltantes[*]} (puede pedir tu contraseña)"
  sudo apt-get update
  sudo apt-get install -y "${faltantes[@]}"
else
  echo "Ya están instalados."
fi

paso "Node.js $NODE_MAJOR"
# Si nvm ya existe, primero se carga: en un script no se lee ~/.bashrc.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then nvm_seguro; fi
if node_valido; then
  echo "Ya está instalado."
else
  if [[ ! -s "$HOME/.nvm/nvm.sh" ]]; then
    git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$NVM_VERSION" \
      https://github.com/nvm-sh/nvm.git "$HOME/.nvm"
  fi
  nvm_seguro nvm install "$NODE_MAJOR"
  nvm_seguro nvm alias default "$NODE_MAJOR"
  if ! grep -q 'NVM_DIR' "$HOME/.bashrc" 2> /dev/null; then
    cat >> "$HOME/.bashrc" << 'BASHRC'

# Node.js por proyecto (nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
BASHRC
  fi
fi
echo "node $(node --version) en $(command -v node)"

paso "pnpm $PNPM_VERSION"
if comando_linux pnpm && [[ "$(pnpm --version)" == "$PNPM_VERSION" ]]; then
  echo "Ya está instalado."
else
  npm install --global "pnpm@$PNPM_VERSION"
  hash -r
fi
echo "pnpm $(pnpm --version) en $(command -v pnpm)"

paso "Proyecto en $DESTINO"
if [[ "$ORIGEN" == "$DESTINO" ]]; then
  echo "El script ya corre desde el destino."
elif [[ -e "$DESTINO/package.json" ]]; then
  echo "Ya existe; no se sobrescribe."
else
  # Copia a una carpeta temporal y renombra: una falla no deja el proyecto a medias.
  temporal="$DESTINO.copiando"
  rm -rf "$temporal"
  mkdir -p "$temporal"
  tar -C "$ORIGEN" \
    --exclude=./node_modules --exclude=./.next --exclude=./out --exclude=./.wrangler \
    --exclude=./setup-wsl.log -cf - . | tar -C "$temporal" -xf - --no-same-owner --no-same-permissions
  # En /mnt/c todo aparece como ejecutable; sin esto Git registraría permisos incorrectos.
  find "$temporal" -type d -exec chmod 755 {} +
  find "$temporal" -type f -exec chmod 644 {} +
  chmod 755 "$temporal/scripts/setup-wsl.sh"
  mv "$temporal" "$DESTINO"
  echo "Copiado: $(find "$DESTINO" -type f | wc -l) archivos."
fi

cd "$DESTINO"

paso "Dependencias del proyecto"
pnpm install --frozen-lockfile

paso "Validación: tipos, lint y pruebas"
pnpm check

paso "Validación: compilación"
pnpm build

paso "Acceso a GitHub (no se instala nada)"
if [[ -n "$(git config --global user.name || true)" && -n "$(git config --global user.email || true)" ]]; then
  echo "Identidad de Git: configurada"
else
  echo "Pendiente: configura git config --global user.name y user.email"
fi
ssh_salida="$(ssh -o BatchMode=yes -o ConnectTimeout=10 -T git@github.com 2>&1 || true)"
if [[ "$ssh_salida" == *"successfully authenticated"* ]]; then
  echo "SSH con GitHub: funciona"
else
  echo "Pendiente: la llave SSH de este Ubuntu no autenticó con GitHub"
fi

printf '\nRESULTADO: OK\nProyecto: %s\n' "$DESTINO"
