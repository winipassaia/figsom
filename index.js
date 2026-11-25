// figsom (modo terminal) — crie e envie figurinhas com som no WhatsApp
// Uso: npm install && npm start → escaneie o QR em "Aparelhos conectados"
// Na conversa "Você": responda um vídeo com "!som", ou "!som nome" (arquivos em memes/)
// Projeto não oficial. Leia os avisos no README antes de usar.

import qrcode from 'qrcode-terminal'
import { FigsomBot } from './src/bot.js'

// ===== CONFIG =====
const config = {
  memesDir: 'memes',        // pasta com os memes (nome.mp4, ou nome.webp + nome.ogg/mp3...)
  authDir: 'auth',          // sessão do WhatsApp — NUNCA compartilhe
  apagarComando: true,      // apaga a mensagem "!som ..." depois de enviar
  soConversaComigo: true,   // só aceita comandos na conversa contigo mesmo ("Você")
  capturar: false,          // true = salva figurinhas com som RECEBIDAS em dumps/ (modo estudo)
}
// ==================

const bot = new FigsomBot(config)

bot.on('log', ({ texto }) => console.log(texto))
bot.on('qr', (qr) => {
  console.log('\nEscaneie no celular: WhatsApp → Aparelhos conectados → Conectar um aparelho')
  qrcode.generate(qr, { small: true })
})
bot.on('status', (s) => {
  if (s === 'deslogado') console.log('Rode de novo para escanear um novo QR.')
})

process.on('SIGINT', async () => {
  await bot.stop()
  process.exit(0)
})

export { bot }
if (process.env.NO_START !== '1') bot.start()
