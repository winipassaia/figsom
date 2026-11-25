// bot.js — núcleo do figsom: conecta no WhatsApp e atende os comandos "!som".
// Usado tanto pelo terminal (index.js) quanto pelo app com janela (app/).
//
// Eventos:
//   'log'    ({ nivel: 'info'|'ok'|'aviso'|'erro', texto })
//   'qr'     (string do QR)
//   'status' ('iniciando'|'aguardando-qr'|'conectado'|'reconectando'|'pausado'|'parado'|'deslogado')
//            pausado = desligado pelo usuário com a sessão guardada (volta sem QR)
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
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { instalarGancho } from './raw.js'
import { dissecar } from './captura.js'
import {
  instalarGanchoEncode, conferirFormato, enviarFigSom, paraWebp, paraOgg, definirFfmpeg,
  comPastaTemp, ErroFigsom, limparCaminhos,
} from './enviar.js'

const VIDEO = ['.mp4', '.mov', '.webm', '.mkv', '.gif', '.avi']
const AUDIO = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.aac', '.flac']
const LIMITE_VIDEO = 100 * 1024 * 1024 // 100 MB: só os 10 primeiros segundos são usados mesmo
const ESPERA_LOGOUT_MS = 8000
const GUARDAR_ENVIADAS_MS = 60 * 60 * 1000 // pra reenviar se algum aparelho pedir (retry)

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comPrazo = (promessa, ms) => Promise.race([promessa, espera(ms).then(() => { throw new Error('tempo esgotado') })])

// Nome de meme: só o nome do arquivo, sem pastas (evita "!som ../../alguma-coisa")
const nomeSeguro = (n) => !!n && n === path.basename(n) && !/[\\/:]/.test(n) && !n.startsWith('.')

let ganchosInstalados = false

export class FigsomBot extends EventEmitter {
  constructor({
    authDir = 'auth',
    memesDir = 'memes',
    dumpDir = 'dumps',
    ffmpeg = 'ffmpeg',
    dicaFfmpeg = 'Instale o ffmpeg (Windows: winget install ffmpeg; Ubuntu/Debian: sudo apt install ffmpeg).',
    apagarComando = true,
    soConversaComigo = true,
    capturar = false,
  } = {}) {
    super()
    Object.assign(this, { authDir, memesDir, dumpDir, dicaFfmpeg, apagarComando, soConversaComigo, capturar })
    definirFfmpeg(ffmpeg)
    this.logger = pino({ level: 'silent' })
    this.sock = null
    this.parando = false
    this.status = 'parado'
    this.jaVistos = new Set()
    this.tentativas = 0
    this.geracao = 0 // muda a cada start/stop/logout: invalida sockets e timers antigos
    this.timerReconexao = null
    this.enviadas = new Map() // id → mensagem enviada (o PRÓPRIO objeto, pro reenvio funcionar)
    if (!ganchosInstalados) {
      instalarGanchoEncode()
      if (capturar) instalarGancho(dumpDir, (t) => this.log(t))
      ganchosInstalados = true
    }
    this.problemaFormato = conferirFormato()
  }

  log(texto, nivel = 'info') {
    this.emit('log', { nivel, texto, hora: new Date() })
  }

  setStatus(s) {
    this.status = s
    this.emit('status', s)
  }

  // ---------- conexão ----------
  cancelarReconexao() {
    clearTimeout(this.timerReconexao)
    this.timerReconexao = null
  }

  // Encerra o socket atual (se houver) e esquece ele: eventos dele passam a ser ignorados
  encerrarSocket() {
    const sock = this.sock
    this.sock = null
    try { sock?.end(undefined) } catch {}
  }

  async start() {
    this.cancelarReconexao()
    this.encerrarSocket()
    const geracao = ++this.geracao
    this.parando = false
    this.setStatus('iniciando')
    if (this.problemaFormato && geracao === 1) {
      this.log(`O formato da figurinha com som não está saindo certo com esta versão do Baileys (${this.problemaFormato}). O envio fica desligado.`, 'erro')
    }
    await fs.mkdir(this.memesDir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    let version
    try {
      ;({ version } = await comPrazo(fetchLatestBaileysVersion(), 8000))
    } catch {
      this.log('Não consegui checar a versão do WhatsApp Web, usando a padrão.', 'aviso')
    }
    // Enquanto esperávamos, alguém pode ter chamado stop/logout/start: aí este start morre aqui
    if (geracao !== this.geracao || this.parando) return

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: this.logger,
      markOnlineOnConnect: false,
      syncFullHistory: false, // não puxa histórico de conversas
      shouldSyncHistoryMessage: () => false,
      getMessage: async (key) => this.enviadas.get(key.id)?.mensagem,
    })
    this.sock = sock
    const atual = () => this.sock === sock

    sock.ev.on('creds.update', async () => {
      if (!atual()) return
      try { await saveCreds() } catch (e) { this.log(`Não consegui salvar a sessão: ${limparCaminhos(e.message)}`, 'erro') }
    })

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (!atual()) return // socket antigo: ignora tudo
      try {
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
        if (connection === 'close') await this.aoFechar(lastDisconnect, geracao)
      } catch (e) {
        this.log(`Erro na conexão: ${limparCaminhos(e.message)}`, 'erro')
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!atual()) return
      // 'append' inclui o que chegou enquanto o figsom estava fechado
      if (type !== 'notify' && type !== 'append') return
      for (const msg of messages) {
        try {
          await this.tratarComando(sock, msg)
          if (this.capturar) await dissecar(msg, this.dumpDir, (t) => this.log(t))
        } catch (e) {
          this.log(`Erro: ${limparCaminhos(e.message)}`, 'erro')
        }
      }
    })
  }

  async aoFechar(lastDisconnect, geracao) {
    this.sock = null
    const code = lastDisconnect?.error?.output?.statusCode
    if (this.parando) {
      this.setStatus('parado')
    } else if (code === DisconnectReason.loggedOut) {
      this.log('A conta foi desconectada pelo celular. Conecte de novo pelo QR.', 'aviso')
      await this.apagarSessao()
      this.setStatus('deslogado')
    } else if (code === DisconnectReason.forbidden) {
      // 403: não adianta insistir (conta bloqueada/banida ou aparelhos vinculados bloqueados)
      this.log('O WhatsApp recusou a conexão (403). Isso costuma indicar que a conta foi bloqueada ou que ela não pode usar aparelhos vinculados agora. Parei de tentar; confira o WhatsApp no celular.', 'erro')
      this.setStatus('parado')
    } else if (code === DisconnectReason.connectionReplaced) {
      // 440: a mesma sessão conectou em outro lugar; insistir faria um derrubar o outro sem parar
      this.log('Esta sessão foi aberta em outro lugar (outra janela do figsom, ou o modo terminal usando a mesma pasta). Parei por aqui pra um não ficar derrubando o outro.', 'erro')
      this.setStatus('parado')
    } else {
      this.setStatus('reconectando')
      this.tentativas++
      const segundos = Math.min(2 ** this.tentativas, 30) // 2s, 4s, 8s... até 30s
      if (this.tentativas === 4) this.log('Não estou conseguindo falar com o WhatsApp. Confira sua internet; vou continuar tentando.', 'erro')
      this.log(`Conexão caiu (${code ?? '?'}), tentando de novo em ${segundos}s...`, 'aviso')
      this.cancelarReconexao()
      this.timerReconexao = setTimeout(() => {
        this.timerReconexao = null
        if (this.parando || geracao !== this.geracao) return
        this.start().catch((e) => this.log(limparCaminhos(e.message), 'erro'))
      }, segundos * 1000)
    }
  }

  async stop(status = 'parado') {
    this.parando = true
    this.geracao++
    this.cancelarReconexao()
    this.encerrarSocket()
    this.setStatus(status)
  }

  // Desliga a conexão mas MANTÉM a sessão (igual ao Ctrl+C do terminal ou a fechar o app):
  // pra voltar é só start(), sem QR. O figsom continua na lista de aparelhos conectados.
  async pausar() {
    await this.stop('pausado')
    this.log('⏸️  Pausado. O figsom parou de atender o "!som", mas a conta continua conectada: clique em Retomar pra voltar, sem QR.')
  }

  async temSessaoSalva() {
    try {
      const creds = JSON.parse(await fs.readFile(path.join(this.authDir, 'creds.json'), 'utf8'))
      return !!creds?.me?.id
    } catch {
      return false
    }
  }

  // Desconecta a conta (some de "Aparelhos conectados") e apaga a sessão local
  async logout() {
    this.parando = true
    this.geracao++
    this.cancelarReconexao()
    const sock = this.sock
    this.sock = null // a partir daqui, eventos desse socket são ignorados
    // registrado = já tinha conta vinculada (pelo socket, ou pela sessão salva se estiver pausado)
    const registrado = !!sock?.authState?.creds?.me?.id || (await this.temSessaoSalva())
    let avisou = false
    if (sock && registrado) {
      try {
        await comPrazo(sock.logout(), ESPERA_LOGOUT_MS)
        avisou = true
      } catch {}
    }
    try { sock?.end(undefined) } catch {}
    await this.apagarSessao()
    this.setStatus('deslogado')
    if (avisou || !registrado) {
      this.log('Conta desconectada e sessão apagada deste computador.', 'ok')
    } else {
      this.log('Apaguei a sessão deste computador, mas não consegui avisar o WhatsApp (sem conexão). No celular, abra "Aparelhos conectados" e remova o figsom se ele ainda aparecer lá.', 'aviso')
    }
  }

  async apagarSessao() {
    try {
      await fs.rm(this.authDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (e) {
      this.log(`Não consegui apagar a pasta da sessão (${limparCaminhos(e.message)}). Apague ela à mão: ${limparCaminhos(this.authDir)}`, 'erro')
    }
  }

  // ---------- comandos ----------
  ehConversaComigo(sock, jid) {
    const eu = [sock?.user?.id, sock?.user?.lid, sock?.authState?.creds?.me?.id, sock?.authState?.creds?.me?.lid].filter(Boolean)
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
    if (!nomeSeguro(nome)) throw new ErroFigsom('nome', `Nome inválido: "${nome}". Use só o nome do arquivo que está na pasta de memes, sem pastas.`)
    const webpPronto = await this.acharArquivo(nome, ['.webp'])
    const video = await this.acharArquivo(nome, VIDEO)
    const audio = await this.acharArquivo(nome, AUDIO)
    if (!webpPronto && !video) throw new ErroFigsom('meme', `Não achei "${nome}" na pasta de memes (vídeo ${VIDEO.join(' ')} ou .webp).`)
    const fonteAudio = audio || video
    if (!fonteAudio) throw new ErroFigsom('meme', `Não achei áudio pra "${nome}" (${AUDIO.join(' ')}).`)
    this.log('⚙️  Convertendo...')
    const ogg = await paraOgg(fonteAudio, opcoes)
    const webp = webpPronto ? await fs.readFile(webpPronto) : await paraWebp(video, opcoes)
    return { webp, ogg }
  }

  async listarMemes() {
    await fs.mkdir(this.memesDir, { recursive: true })
    return [...new Set((await fs.readdir(this.memesDir)).filter((f) => !f.startsWith('.')).map((f) => path.parse(f).name))].sort()
  }

  // Baixa a mídia direto pro disco (não pra memória), parando se passar do limite
  async baixarVideo(midia, destino) {
    const tamanho = Number(midia.fileLength || 0)
    const mb = (n) => Math.ceil(n / 1024 / 1024)
    const grande = () => new ErroFigsom('grande', `Esse vídeo é grande demais (${mb(tamanho)} MB). O limite é ${mb(LIMITE_VIDEO)} MB.`)
    if (tamanho > LIMITE_VIDEO) throw grande()
    let total = 0
    const contador = new Transform({
      transform(parte, _enc, cb) {
        total += parte.length
        cb(total > LIMITE_VIDEO ? grande() : null, parte)
      },
    })
    await pipeline(await downloadContentFromMessage(midia, 'video'), contador, createWriteStream(destino))
  }

  lembrarEnviada(id, mensagem) {
    const agora = Date.now()
    for (const [k, v] of this.enviadas) if (agora - v.quando > GUARDAR_ENVIADAS_MS || this.enviadas.size > 50) this.enviadas.delete(k)
    this.enviadas.set(id, { mensagem, quando: agora })
  }

  mensagemDeErro(e) {
    if (e?.codigo === 'ffmpeg-ausente') return `ffmpeg não encontrado. ${this.dicaFfmpeg}`
    if (e instanceof ErroFigsom) return e.message
    const texto = String(e?.message || e)
    if (/Failed to fetch stream/i.test(texto) || [403, 404, 410].includes(e?.output?.statusCode)) {
      return 'Não consegui baixar o vídeo. Se ele for antigo, mande de novo e responda com "!som".'
    }
    return limparCaminhos(texto)
  }

  async tratarComando(sock, msg) {
    if (!msg.key.fromMe || this.jaVistos.has(msg.key.id)) return
    if (this.soConversaComigo && !this.ehConversaComigo(sock, msg.key.remoteJid)) return
    const m = msg.message
    const texto = (m?.conversation || m?.extendedTextMessage?.text || '').trim()
    if (!/^!som\b/i.test(texto)) return
    this.jaVistos.add(msg.key.id)
    if (this.jaVistos.size > 500) this.jaVistos.delete(this.jaVistos.values().next().value)
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

    const desc = [arg || 'vídeo respondido', opcoes.modo === 'ajustar' ? 'ajustar' : '', opcoes.fim != null ? `${opcoes.inicio}-${opcoes.fim}s` : ''].filter(Boolean).join(', ')
    this.log(`🎬 Pedido recebido: !som (${desc})`)
    try {
      if (this.problemaFormato) throw new ErroFigsom('formato', `Envio desligado: ${this.problemaFormato}. Atualize o figsom.`)
      let webp, ogg
      const citada = m?.extendedTextMessage?.contextInfo?.quotedMessage
      const videoCitado = citada?.videoMessage || citada?.ptvMessage
      if (!arg && videoCitado) {
        await comPastaTemp(async (dir) => {
          const tmp = path.join(dir, 'video.mp4')
          this.log('⬇️  Baixando o vídeo...')
          await this.baixarVideo(videoCitado, tmp)
          this.log('⚙️  Convertendo vídeo em figurinha + áudio...')
          // vídeos do WhatsApp são sempre MP4/MOV: força o formato em vez de deixar o ffmpeg adivinhar
          ogg = await paraOgg(tmp, { ...opcoes, formato: 'mov' })
          webp = await paraWebp(tmp, { ...opcoes, formato: 'mov' })
        })
      } else if (arg) {
        ;({ webp, ogg } = await this.carregarMeme(arg, opcoes))
      } else {
        throw new ErroFigsom('uso', 'Responda um VÍDEO com "!som" (segure o vídeo → Responder), ou use "!som nome".')
      }
      this.log('⬆️  Enviando...')
      const r = await enviarFigSom(sock, jid, webp, ogg, this.logger)
      this.lembrarEnviada(r.messageId, r.mensagem)
      this.log(`✅ Figurinha com som enviada! (${r.kb} KB, ${r.seconds}s) Toque nela e salve nas figurinhas.`, 'ok')
    } catch (e) {
      this.log(`✖ ${this.mensagemDeErro(e)}`, 'erro')
      return
    }
    if (this.apagarComando) {
      try {
        await sock.sendMessage(jid, { delete: msg.key })
      } catch (e) {
        this.log(`A figurinha foi enviada, mas não consegui apagar o "!som" (${limparCaminhos(e.message)}).`, 'aviso')
      }
    }
  }
}
