#!/usr/bin/env bash
# figsom — inicia o bot no Linux/macOS (confere dependências e instala na primeira vez)
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js não encontrado. Veja docs/LINUX.md (passo 1)."; exit 1
fi
NV=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NV" -lt 20 ]; then
  echo "❌ Seu Node.js é a versão $NV. O figsom precisa da 20 ou maior. Veja docs/LINUX.md (passo 1)."; exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "❌ ffmpeg não encontrado. Ubuntu/Debian: sudo apt install ffmpeg"; exit 1
fi
if ! ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp; then
  echo "⚠  Seu ffmpeg não tem libwebp — a conversão de vídeo vai falhar."
fi
if [ ! -d node_modules ]; then
  echo "📦 Instalando dependências (só na primeira vez)..."
  npm install --omit=dev
fi
exec npm start
