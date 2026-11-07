@echo off
rem Prepara una computadora con Windows para editar el catalogo de Stock One.
rem Se puede ejecutar varias veces: solo hace lo que falte.
title Instalacion de Stock One

rem Direccion del repositorio en GitHub.
set "REPO=https://github.com/RickcariasF/stock-one.git"
set "DESTINO=%USERPROFILE%\Documents\stock-one"
set "PNPM_VERSION=12.16.1"
set "WINGET=--exact --source winget --accept-package-agreements --accept-source-agreements"

where winget >nul 2>nul
if errorlevel 1 (
  echo Este equipo no tiene winget. Instala Git y Node.js a mano desde sus sitios oficiales.
  goto fin
)

set "REINICIAR="
where git >nul 2>nul
if errorlevel 1 (
  echo Instalando Git...
  winget install --id Git.Git %WINGET%
  set "REINICIAR=1"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Instalando Node.js...
  winget install --id OpenJS.NodeJS.LTS %WINGET%
  set "REINICIAR=1"
)
if defined REINICIAR (
  echo.
  echo Listo. Cierra esta ventana y ejecuta este archivo otra vez para continuar.
  goto fin
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo Instalando pnpm...
  call npm install --global pnpm@%PNPM_VERSION%
  if errorlevel 1 goto fin
)

if not exist "%DESTINO%\.git" (
  echo Descargando el proyecto en %DESTINO%...
  git clone "%REPO%" "%DESTINO%"
  if errorlevel 1 goto fin
)

rem Git firma cada publicacion con estos datos.
git config --global user.name >nul 2>nul
if errorlevel 1 (
  set /p "NOMBRE=Tu nombre: "
  call git config --global user.name "%%NOMBRE%%"
)
git config --global user.email >nul 2>nul
if errorlevel 1 (
  set /p "CORREO=Tu correo de GitHub: "
  call git config --global user.email "%%CORREO%%"
)

echo.
echo Se abrira GitHub en el navegador para iniciar sesion. No se publica nada.
git -C "%DESTINO%" push --dry-run origin main
if errorlevel 1 (
  echo No se pudo confirmar el permiso en GitHub. Pide que te agreguen al repositorio.
  goto fin
)

echo.
echo Listo. Abre el editor con StockOne-Editor.bat en %DESTINO%
:fin
echo.
pause
