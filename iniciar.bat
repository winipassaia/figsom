@echo off
rem figsom - inicia o bot no Windows (confere dependencias e instala na primeira vez)
cd /d "%~dp0"
chcp 65001 >nul

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org
  pause
  exit /b 1
)
for /f %%v in ('node -p "process.versions.node.split(String.fromCharCode(46))[0]"') do set NV=%%v
if %NV% LSS 20 (
  echo [ERRO] Seu Node.js e a versao %NV%. O figsom precisa da 20 ou maior.
  pause
  exit /b 1
)
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo [ERRO] ffmpeg nao encontrado. Rode: winget install ffmpeg  e abra este arquivo de novo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias, so na primeira vez...
  call npm install --omit=dev
)
call npm start
pause
