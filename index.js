// figsom (modo terminal) — crie e envie figurinhas com som no WhatsApp
// Uso: npm install && npm start → escaneie o QR em "Aparelhos conectados"
// Na conversa "Você": responda um vídeo com "!criar", ou "!criar nome" (arquivos em memes/). "!ajuda" lista tudo.
// Projeto não oficial. Leia os avisos no README antes de usar.

import qrcode from 'qrcode-terminal'
import { FigsomBot } from './src/bot.js'
import { cancelarDownloads } from './src/baixar.js'

// ===== CONFIG =====
const config = {
  memesDir: 'memes',        // pasta com os memes (nome.mp4, ou nome.webp + nome.ogg/mp3...)
  authDir: 'auth',          // sessão do WhatsApp — NUNCA compartilhe
  binDir: 'bin',            // onde fica o yt-dlp (baixado da página oficial quando baixarLinks está ligado)
  baixarLinks: false,       // true = "!criar <link>" e "!salvar <link>" do X e do TikTok (baixa o yt-dlp, ~25 MB)
  apagarPedido: false,      // true = apaga a mensagem "!criar ..." depois de enviar (sem isso, o figsom só reage ✅)
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
  cancelarDownloads()
  await bot.stop()
  process.exit(0)
})

export { bot }
if (process.env.NO_START !== '1') {
  bot.start()
  if (config.baixarLinks) bot.conferirBaixador()
}
