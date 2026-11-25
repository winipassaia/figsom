// figsom — crie e envie figurinhas com som no WhatsApp
// Uso: npm install && npm start → escaneie o QR em "Aparelhos conectados"
// Na conversa "Você": responda um vídeo com "!som", ou "!som nome" (arquivos em memes/)
// Projeto não oficial. Leia os avisos no README antes de usar.

import makeWASocket, {
  areJidsSameUser,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  BufferJSON,
} from 'baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import fs from 'node:fs/promises'
import path from 'node:path'
import { instalarGancho } from './raw.js'
import { instalarGanchoEncode, enviarFigSom, paraWebp, paraOgg } from './enviar.js'
import os from 'node:os'

// ===== CONFIG =====
const MEMES_DIR = 'memes'          // pasta com os memes (nome.mp4, ou nome.webp + nome.ogg/mp3...)
const APAGAR_COMANDO = true        // apaga a mensagem "!som ..." depois de enviar
const SO_CONVERSA_COMIGO = true    // só aceita comandos na conversa contigo mesmo ("Você")
const CAPTURAR = false             // true = volta a salvar figurinhas recebidas em dumps/ (modo estudo)
// ==================

if (CAPTURAR) instalarGancho()
instalarGanchoEncode()

const DUMP_DIR = 'dumps'
const logger = pino({ level: 'warn' })

// Tipos de mensagem "chatos" que não interessam
const IGNORAR = new Set([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'messageContextInfo',
  'reactionMessage',
])

// Procura recursivamente qualquer objeto que pareça mídia (tem mediaKey + directPath)
function acharMidias(obj, caminho = [], achados = []) {
  if (!obj || typeof obj !== 'object' || Buffer.isBuffer(obj) || obj instanceof Uint8Array) return achados
  if (obj.mediaKey && (obj.directPath || obj.url)) achados.push({ caminho: caminho.join('.'), midia: obj })
  for (const [k, v] of Object.entries(obj)) acharMidias(v, [...caminho, k], achados)
  return achados
}

// Ordem de tentativa do tipo de chave HKDF, baseada no mimetype/caminho
function tiposCandidatos(caminho, mimetype = '') {
  const m = mimetype.toLowerCase()
  const c = caminho.toLowerCase()
  const lista = []
  if (m.startsWith('audio') || c.includes('audio') || c.includes('sound')) lista.push('audio')
  if (m.includes('webp') || c.includes('sticker')) lista.push('sticker')
  if (m.startsWith('video')) lista.push('video')
  if (m.startsWith('image')) lista.push('image')
  for (const t of ['sticker', 'audio', 'video', 'image', 'document']) if (!lista.includes(t)) lista.push(t)
  return lista
}

function extensao(mimetype = '', tipo) {
  const m = mimetype.split(';')[0].trim()
  const mapa = {
    'image/webp': 'webp', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
    'audio/aac': 'aac', 'video/mp4': 'mp4', 'image/jpeg': 'jpg', 'image/png': 'png',
  }
  return mapa[m] || (tipo === 'audio' ? 'audio' : 'bin')
}

async function baixarMidia(midia, caminho, pastaSaida, idx) {
  for (const tipo of tiposCandidatos(caminho, midia.mimetype)) {
    try {
      const stream = await downloadContentFromMessage(midia, tipo)
      const partes = []
      for await (const p of stream) partes.push(p)
      const buf = Buffer.concat(partes)
      if (!buf.length) continue
      const nome = `${idx}_${caminho.replace(/[^\w.]/g, '_')}.${extensao(midia.mimetype, tipo)}`
      await fs.writeFile(path.join(pastaSaida, nome), buf)
      console.log(`   ⬇ ${nome} (${buf.length} bytes, chave=${tipo}, mime=${midia.mimetype || '?'})`)
      return
    } catch {
      // chave errada → tenta o próximo tipo
    }
  }
  console.log(`   ✖ não consegui baixar ${caminho}`)
}

async function dissecar(msg) {
  const conteudo = msg.message
  if (!conteudo) return
  const tipos = Object.keys(conteudo).filter((k) => !IGNORAR.has(k))
  if (!tipos.length) {
    console.log(`\n❓ mensagem de ${msg.pushName || msg.key.remoteJid} sem tipo conhecido (campos: ${Object.keys(conteudo).join(', ') || 'nenhum'}) — veja dumps/raw/`)
    return
  }

  const ehInteressante = tipos.some((t) => /sticker|sound/i.test(t))
  const de = msg.pushName || msg.key.remoteJid
  console.log(`\n📩 ${de} → [${tipos.join(', ')}]`)
  if (!ehInteressante) return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const pasta = path.join(DUMP_DIR, `${stamp}_${tipos[0]}`)
  await fs.mkdir(pasta, { recursive: true })

  // JSON completo (Buffers preservados em base64 via BufferJSON)
  await fs.writeFile(path.join(pasta, 'mensagem.json'), JSON.stringify(msg, BufferJSON.replacer, 2))

  // Resumo dos campos de cada tipo, pra bater o olho
  for (const t of tipos) {
    const v = conteudo[t]
    if (v && typeof v === 'object') console.log(`   ${t}: { ${Object.keys(v).join(', ')} }`)
  }

  const midias = acharMidias(conteudo)
  console.log(`   ${midias.length} mídia(s) encontrada(s)`)
  let i = 0
  for (const { caminho, midia } of midias) await baixarMidia(midia, caminho, pasta, i++)
  console.log(`   💾 salvo em ${pasta}/`)
}

// ---------- comandos ----------
const VIDEO = ['.mp4', '.mov', '.webm', '.mkv', '.gif', '.avi']
const AUDIO = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.aac', '.flac']
const jaVistos = new Set()

function textoDe(m) {
  return m?.conversation || m?.extendedTextMessage?.text || ''
}

async function acharArquivo(nome, exts) {
  for (const e of exts) {
    const p = path.join(MEMES_DIR, nome + e)
    try { await fs.access(p); return p } catch {}
  }
  return null
}

async function carregarMeme(nome) {
  const webpPronto = await acharArquivo(nome, ['.webp'])
  const video = await acharArquivo(nome, VIDEO)
  const audio = await acharArquivo(nome, AUDIO)
  if (!webpPronto && !video) throw new Error(`não achei ${nome}.webp nem vídeo (${VIDEO.join(' ')}) em ${MEMES_DIR}/`)
  const fonteAudio = audio || video
  if (!fonteAudio) throw new Error(`não achei áudio pra ${nome} (${AUDIO.join(' ')})`)
  const webp = webpPronto ? await fs.readFile(webpPronto) : await paraWebp(video)
  const ogg = await paraOgg(fonteAudio)
  return { webp, ogg }
}

function ehConversaComigo(sock, jid) {
  const eu = [sock.user?.id, sock.user?.lid, sock.authState?.creds?.me?.id, sock.authState?.creds?.me?.lid].filter(Boolean)
  return eu.some((meu) => areJidsSameUser(meu, jid))
}

async function tratarComando(sock, msg) {
  if (!msg.key.fromMe || jaVistos.has(msg.key.id)) return
  if (SO_CONVERSA_COMIGO && !ehConversaComigo(sock, msg.key.remoteJid)) return
  const texto = textoDe(msg.message).trim()
  if (!/^!som\b/i.test(texto)) return
  jaVistos.add(msg.key.id)
  const jid = msg.key.remoteJid
  const arg = texto.slice(4).trim()

  if (arg === 'lista') {
    await fs.mkdir(MEMES_DIR, { recursive: true })
    const nomes = [...new Set((await fs.readdir(MEMES_DIR)).map((f) => path.parse(f).name))].sort()
    await sock.sendMessage(jid, { text: nomes.length ? '🔊 memes:\n' + nomes.join('\n') : `pasta ${MEMES_DIR}/ vazia` })
    return
  }

  console.log(`\n🎬 !som ${arg || '(resposta a vídeo)'} → ${jid}`)
  try {
    let webp, ogg
    const citada = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const videoCitado = citada?.videoMessage || citada?.ptvMessage
    if (!arg && videoCitado) {
      // "!som" respondendo um vídeo do chat → converte esse vídeo
      const stream = await downloadContentFromMessage(videoCitado, 'video')
      const partes = []
      for await (const p of stream) partes.push(p)
      const tmp = path.join(os.tmpdir(), `citado_${Date.now()}.mp4`)
      await fs.writeFile(tmp, Buffer.concat(partes))
      webp = await paraWebp(tmp)
      ogg = await paraOgg(tmp)
    } else if (arg) {
      ;({ webp, ogg } = await carregarMeme(arg))
    } else {
      throw new Error('uso: "!som nome" ou responda um vídeo com "!som"')
    }
    const r = await enviarFigSom(sock, jid, webp, ogg, logger)
    console.log(`   ✅ enviada (${r.kb} KB, ${r.seconds}s)`)
    if (APAGAR_COMANDO) await sock.sendMessage(jid, { delete: msg.key })
  } catch (e) {
    console.error('   ✖', e.message)
    if (/ENOENT.*ffmpeg|spawn ffmpeg/i.test(e.message)) console.error('   → instala o ffmpeg e põe no PATH (winget install ffmpeg)')
  }
}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,                // não puxa histórico de conversas
    shouldSyncHistoryMessage: () => false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('Escaneia com o número secundário (WhatsApp > Aparelhos conectados):')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') console.log(`✅ Conectado${SO_CONVERSA_COMIGO ? ' — comandos só na conversa "Você"' : ''}. "!som nome", "!som" respondendo um vídeo, "!som lista"`)
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.log('Deslogado. Apaga a pasta auth/ e roda de novo.')
      } else {
        console.log(`Conexão caiu (${code}), reconectando...`)
        iniciar()
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return
    for (const msg of messages) {
      try {
        await tratarComando(sock, msg)
        if (CAPTURAR) await dissecar(msg)
      } catch (e) {
        console.error('Erro:', e.message)
      }
    }
  })
}

export { tratarComando }
if (process.env.NO_START !== '1') iniciar()
