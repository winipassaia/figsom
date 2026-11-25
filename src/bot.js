// bot.js — núcleo do figsom: conecta no WhatsApp e atende os comandos "!som".
// Usado tanto pelo terminal (index.js) quanto pelo app com janela (app/).
//
// Eventos:
//   'log'    ({ nivel: 'info'|'ok'|'aviso'|'erro', texto })
//   'qr'     (string do QR)
//   'status' ('iniciando'|'aguardando-qr'|'conectado'|'reconectando'|'parado'|'deslogado')
//   'conta'  ({ nome, numero })

import makeWASocket, {
  areJidsSameUser,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
} from 'baileys'
import pino from 'pino'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { instalarGancho } from './raw.js'
import { dissecar } from './captura.js'
import { instalarGanchoEncode, enviarFigSom, paraWebp, paraOgg, definirFfmpeg } from './enviar.js'

const VIDEO = ['.mp4', '.mov', '.webm', '.mkv', '.gif', '.avi']
const AUDIO = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.aac', '.flac']

let ganchosInstalados = false

export class FigsomBot extends EventEmitter {
  constructor({
    authDir = 'auth',
    memesDir = 'memes',
    dumpDir = 'dumps',
    ffmpeg = 'ffmpeg',
    apagarComando = true,
    soConversaComigo = true,
    capturar = false,
  } = {}) {
    super()
    Object.assign(this, { authDir, memesDir, dumpDir, apagarComando, soConversaComigo, capturar })
    definirFfmpeg(ffmpeg)
    this.logger = pino({ level: 'silent' })
    this.sock = null
    this.parando = false
    this.status = 'parado'
    this.jaVistos = new Set()
    this.tentativas = 0
    if (!ganchosInstalados) {
      instalarGanchoEncode()
      if (capturar) instalarGancho(dumpDir, (t) => this.log(t))
      ganchosInstalados = true
    }
  }

  log(texto, nivel = 'info') {
    this.emit('log', { nivel, texto, hora: new Date() })
  }

  setStatus(s) {
    this.status = s
    this.emit('status', s)
  }

  // ---------- conexão ----------
  async start() {
    this.parando = false
    this.setStatus('iniciando')
    await fs.mkdir(this.memesDir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    let version
    try {
      ;({ version } = await fetchLatestBaileysVersion())
    } catch {
      this.log('Não consegui checar a versão do WhatsApp Web, usando a padrão.', 'aviso')
    }

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: this.logger,
      markOnlineOnConnect: false,
      syncFullHistory: false, // não puxa histórico de conversas
      shouldSyncHistoryMessage: () => false,
    })
    this.sock = sock

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.setStatus('aguardando-qr')
        this.emit('qr', qr)
      }
      if (connection === 'open') {
        this.tentativas = 0
        this.setStatus('conectado')
        const numero = (sock.user?.id || '').split(':')[0].split('@')[0]
        this.emit('conta', { nome: sock.user?.name || '', numero })
        this.log(`Conectado${sock.user?.name ? ' como ' + sock.user.name : ''}! Agora é só usar o "!som" na conversa com você mesmo.`, 'ok')
      }
      if (connection === 'close') {
        if (this.sock !== sock) return // socket antigo
        const code = lastDisconnect?.error?.output?.statusCode
        if (this.parando) {
          this.setStatus('parado')
        } else if (code === DisconnectReason.loggedOut) {
          this.log('A conta foi desconectada pelo celular. Conecte de novo pelo QR.', 'aviso')
          await this.apagarSessao()
          this.setStatus('deslogado')
        } else {
          this.setStatus('reconectando')
          this.tentativas++
          const espera = Math.min(2 ** this.tentativas, 30) // 2s, 4s, 8s... até 30s
          if (this.tentativas === 4) this.log('Não estou conseguindo falar com o WhatsApp. Confira sua internet; vou continuar tentando.', 'erro')
          this.log(`Conexão caiu (${code ?? '?'}), tentando de novo em ${espera}s...`, 'aviso')
          setTimeout(() => !this.parando && this.start().catch((e) => this.log(e.message, 'erro')), espera * 1000)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return
      for (const msg of messages) {
        try {
          await this.tratarComando(msg)
          if (this.capturar) await dissecar(msg, this.dumpDir, (t) => this.log(t))
        } catch (e) {
          this.log(`Erro: ${e.message}`, 'erro')
        }
      }
    })
  }

  async stop() {
    this.parando = true
    const sock = this.sock
    this.sock = null
    try { sock?.end(undefined) } catch {}
    this.setStatus('parado')
  }

  // Desconecta a conta (some de "Aparelhos conectados") e apaga a sessão local
  async logout() {
    this.parando = true
    try { await this.sock?.logout() } catch {}
    this.sock = null
    await this.apagarSessao()
    this.setStatus('deslogado')
    this.log('Conta desconectada e sessão apagada deste computador.', 'ok')
  }

  async apagarSessao() {
    await fs.rm(this.authDir, { recursive: true, force: true })
  }

  // ---------- comandos ----------
  ehConversaComigo(jid) {
    const s = this.sock
    const eu = [s?.user?.id, s?.user?.lid, s?.authState?.creds?.me?.id, s?.authState?.creds?.me?.lid].filter(Boolean)
    return eu.some((meu) => areJidsSameUser(meu, jid))
  }

  async acharArquivo(nome, exts) {
    for (const e of exts) {
      const p = path.join(this.memesDir, nome + e)
      try { await fs.access(p); return p } catch {}
    }
    return null
  }

  async carregarMeme(nome, opcoes) {
    const webpPronto = await this.acharArquivo(nome, ['.webp'])
    const video = await this.acharArquivo(nome, VIDEO)
    const audio = await this.acharArquivo(nome, AUDIO)
    if (!webpPronto && !video) throw new Error(`Não achei "${nome}" na pasta de memes (vídeo ${VIDEO.join(' ')} ou .webp).`)
    const fonteAudio = audio || video
    if (!fonteAudio) throw new Error(`Não achei áudio pra "${nome}" (${AUDIO.join(' ')}).`)
    this.log('⚙️  Convertendo...')
    const webp = webpPronto ? await fs.readFile(webpPronto) : await paraWebp(video, opcoes)
    const ogg = await paraOgg(fonteAudio, opcoes)
    return { webp, ogg }
  }

  async listarMemes() {
    await fs.mkdir(this.memesDir, { recursive: true })
    return [...new Set((await fs.readdir(this.memesDir)).filter((f) => !f.startsWith('.')).map((f) => path.parse(f).name))].sort()
  }

  async tratarComando(msg) {
    const sock = this.sock
    if (!msg.key.fromMe || this.jaVistos.has(msg.key.id)) return
    if (this.soConversaComigo && !this.ehConversaComigo(msg.key.remoteJid)) return
    const m = msg.message
    const texto = (m?.conversation || m?.extendedTextMessage?.text || '').trim()
    if (!/^!som\b/i.test(texto)) return
    this.jaVistos.add(msg.key.id)
    const jid = msg.key.remoteJid

    // "!som [nome] [ajustar] [2-6]" — em qualquer ordem
    const opcoes = { modo: 'cortar' }
    const resto = []
    for (const t of texto.slice(4).trim().split(/\s+/).filter(Boolean)) {
      const faixa = t.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/)
      if (faixa) { opcoes.inicio = parseFloat(faixa[1].replace(',', '.')); opcoes.fim = parseFloat(faixa[2].replace(',', '.')) }
      else if (/^(ajustar|inteiro)$/i.test(t)) opcoes.modo = 'ajustar'
      else resto.push(t)
    }
    const arg = resto.join(' ')

    if (arg === 'lista') {
      const nomes = await this.listarMemes()
      await sock.sendMessage(jid, { text: nomes.length ? '🔊 memes:\n' + nomes.join('\n') : 'A pasta de memes está vazia.' })
      this.log(`📋 Lista de memes enviada (${nomes.length}).`)
      return
    }

    const desc = [arg || 'vídeo respondido', opcoes.modo === 'ajustar' ? 'ajustar' : '', opcoes.fim ? `${opcoes.inicio}-${opcoes.fim}s` : ''].filter(Boolean).join(', ')
    this.log(`🎬 Pedido recebido: !som (${desc})`)
    try {
      let webp, ogg
      const citada = m?.extendedTextMessage?.contextInfo?.quotedMessage
      const videoCitado = citada?.videoMessage || citada?.ptvMessage
      if (!arg && videoCitado) {
        this.log('⬇️  Baixando o vídeo...')
        const stream = await downloadContentFromMessage(videoCitado, 'video')
        const partes = []
        for await (const p of stream) partes.push(p)
        const tmp = path.join(os.tmpdir(), `figsom_${Date.now()}.mp4`)
        await fs.writeFile(tmp, Buffer.concat(partes))
        this.log('⚙️  Convertendo vídeo em figurinha + áudio...')
        webp = await paraWebp(tmp, opcoes)
        ogg = await paraOgg(tmp, opcoes)
        fs.rm(tmp, { force: true }).catch(() => {})
      } else if (arg) {
        ;({ webp, ogg } = await this.carregarMeme(arg, opcoes))
      } else {
        throw new Error('Responda um VÍDEO com "!som" (segure o vídeo → Responder), ou use "!som nome".')
      }
      this.log('⬆️  Enviando...')
      const r = await enviarFigSom(sock, jid, webp, ogg, this.logger)
      this.log(`✅ Figurinha com som enviada! (${r.kb} KB, ${r.seconds}s) Toque nela e salve nas figurinhas.`, 'ok')
      if (this.apagarComando) await sock.sendMessage(jid, { delete: msg.key })
    } catch (e) {
      let texto = e.message
      if (/ENOENT|spawn/i.test(texto) && /ffmpeg/i.test(texto)) texto = 'ffmpeg não encontrado. Instale o ffmpeg (Windows: winget install ffmpeg).'
      this.log(`✖ ${texto}`, 'erro')
    }
  }
}
