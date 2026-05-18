@echo off
cd /d "%~dp0"

if not exist ".env.brand" (
  echo ERREUR: .env.brand introuvable. Demande a Claude de le recreer.
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%a in (".env.brand") do (
  if /i "%%a"=="SUPABASE_URL" set "SUPABASE_URL=%%b"
  if /i "%%a"=="SUPABASE_SERVICE_KEY" set "SUPABASE_SERVICE_KEY=%%b"
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERREUR: Node.js manquant. Installe-le sur https://nodejs.org
  pause
  exit /b 1
)

echo.
echo === SOLUTION PHONE - UPLOAD KIT DE MARQUE ===
echo.
echo URL : %SUPABASE_URL%
echo Cle : sb_secret_***
echo.
echo Lancement de l'upload des 13 visuels...
echo.

node scripts\upload-brand-assets.js

echo.
echo === FIN ===
echo Appuie sur une touche pour fermer.
pause >nul
