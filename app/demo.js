// demo.js — só pra desenvolvimento: simula estados e salva screenshots em /tmp
import fs from 'node:fs'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

export async function rodarDemo({ janela, estado, enviar, publico, addLog, QRCode, app }) {
  const saida = process.env.FIGSOM_DEMO_SAIDA || '/tmp'
  const foto = async (nome) => {
    await espera(900)
    const img = await janela.webContents.capturePage()
    fs.writeFileSync(`${saida}/${nome}.png`, img.toPNG())
  }
  const set = (s) => { Object.assign(estado, s); enviar('estado', publico()) }
  await espera(1200)
  if (process.env.FIGSOM_DEMO_AVISO) { await foto('0-aviso'); return app.quit() }

  set({ status: 'iniciando' })
  addLog({ nivel: 'info', texto: 'Iniciando conexão com o WhatsApp...', hora: new Date() })
  await foto('1-iniciando')

  const qr = await QRCode.toDataURL('2@demo-figsom-qr-code-de-exemplo-nao-escaneie,abcdefghijklmnopqrstuvwxyz0123456789', { margin: 1, width: 520, color: { dark: '#22193A', light: '#FFFFFF' } })
  set({ status: 'aguardando-qr', qr })
  await foto('2-qr')

  set({ status: 'conectado', qr: null, conta: { nome: 'Ana Souza', numero: '0000000000000' } })
  addLog({ nivel: 'ok', texto: 'Conectado como Ana Souza! Agora é só usar o "!som" na conversa com você mesmo.', hora: new Date() })
  addLog({ nivel: 'info', texto: '🎬 Pedido recebido: !som (vídeo respondido)', hora: new Date() })
  addLog({ nivel: 'info', texto: '⬇️  Baixando o vídeo...', hora: new Date() })
  addLog({ nivel: 'info', texto: '⚙️  Convertendo vídeo em figurinha + áudio...', hora: new Date() })
  addLog({ nivel: 'info', texto: '⬆️  Enviando...', hora: new Date() })
  addLog({ nivel: 'ok', texto: '✅ Figurinha com som enviada! (354 KB, 6s) Toque nela e salve nas figurinhas.', hora: new Date() })
  addLog({ nivel: 'erro', texto: '✖ Responda um VÍDEO com "!som" (segure o vídeo → Responder), ou use "!som nome".', hora: new Date() })
  await foto('3-conectado')

  set({ status: 'deslogado', conta: null })
  await foto('4-desconectado')
  app.quit()
}
