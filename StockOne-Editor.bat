@echo off
rem Abre el editor de Stock One: basta con hacer doble clic en este archivo.
title Editor de Stock One
cd /d "%~dp0"

where git >nul 2>nul || goto falta
where node >nul 2>nul || goto falta
where pnpm >nul 2>nul || goto falta

rem Instala las versiones exactas del lockfile. Si ya estan, termina enseguida.
call pnpm install --frozen-lockfile
if errorlevel 1 goto error

call pnpm editor
if errorlevel 1 goto error
exit /b 0

:falta
echo.
echo Falta instalar Git, Node.js o pnpm.
echo Ejecuta scripts\instalar-stock-one.bat y vuelve a intentarlo.
echo.
pause
exit /b 1

:error
echo.
echo El editor se detuvo. Lee el mensaje de arriba.
echo.
pause
exit /b 1
