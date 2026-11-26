// bot.js — núcleo do figsom: conecta no WhatsApp e atende os comandos (!criar, !salvar, !memes, !ajuda).
// Usado tanto pelo terminal (index.js) quanto pelo app com janela (app/).
//
// Eventos:
//   'log'      ({ nivel: 'info'|'ok'|'aviso'|'erro', texto })
//   'qr'       (string do QR)
//   'status'   ('iniciando'|'aguardando-qr'|'conectado'|'reconectando'|'pausado'|'parado'|'deslogado')
//              pausado = desligado pelo usuário com a sessão guardada (volta sem QR)
//   'conta'    ({ nome, numero })
//   'baixador' ({ estado: 'desligado'|'baixando'|'pronto'|'erro', progresso?, versao? })
//   'memes'    () a pasta de memes ganhou um vídeo novo

import makeWASocket, {
  jidNormalizedUser,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
} from 'baileys'
import pino from 'pino'
import { EventEmitter } from 'node:events'
import { createWriteStream, constants as fsConst } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { instalarGancho } from './raw.js'
import { dissecar } from './captura.js'
import {
  instalarGanchoEncode, conferirFormato, enviarFigSom, paraWebp, paraOgg, definirFfmpeg, inspecionar,
  comPastaTemp, ErroFigsom, limparCaminhos,
} from './enviar.js'
import { interpretarComando, textoAjuda } from './comandos.js'
import { VIDEO, AUDIO, nomeSeguro, acharArquivo, listarBiblioteca, higienizarNome, nomeDoTitulo, nomeLivre } from './memes.js'
import { ComponenteYtDlp, validarLink, baixarComYtDlp, acharNoPath, NOME_SITE } from './baixar.js'

const LIMITE_VIDEO = 100 * 1024 * 1024 // 100 MB: só os 10 primeiros segundos são usados mesmo
const LIMITE_SEG = 10 // a figurinha usa no máximo 10 s
const LIMITE_SALVAR_SEG = 60 // o !salvar guarda até 60 s do vídeo
const ESPERA_LOGOUT_MS = 8000
const GUARDAR_ENVIADAS_MS = 60 * 60 * 1000 // pra reenviar se algum aparelho pedir (retry)

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const comPrazo = (promessa, ms) => Promise.race([promessa, espera(ms).then(() => { throw new Error('tempo esgotado') })])

let ganchosInstalados = false

export class FigsomBot extends EventEmitter {
  constructor({
    authDir = 'auth',
    memesDir = 'memes',
    dumpDir = 'dumps',
    binDir = 'bin',
    ffmpeg = 'ffmpeg',
    dicaFfmpeg = 'Instale o ffmpeg (Windows: winget install ffmpeg; Ubuntu/Debian: sudo apt install ffmpeg).',
    baixarLinks = false,
    dicaBaixador = 'Pra ligar: mude baixarLinks pra true no topo do index.js e reinicie o figsom.',
    apagarPedido = false, // apagar o comando depois de enviar (a reação ✅ já confirma)
    soConversaComigo = true,
    capturar = false,
  } = {}) {
    super()
    Object.assign(this, { authDir, memesDir, dumpDir, ffmpeg, dicaFfmpeg, dicaBaixador, apagarPedido, soConversaComigo, capturar })
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
    this.jidComigo = null // a conversa "Você" como ela chegou nos comandos (número ou LID)
    this.baixarLinks = !!baixarLinks
    this.baixador = { estado: 'desligado' }
    this.componente = new ComponenteYtDlp({
      pasta: binDir,
      log: (t, n) => this.log(t, n),
      aoMudar: (s) => this.mudarBaixador(s),
    })
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
          this.log(`Conectado${sock.user?.name ? ' como ' + sock.user.name : ''}! Agora é só usar o "!criar" na conversa com você mesmo ("!ajuda" mostra todos os comandos).`, 'ok')
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
    this.log('⏸️  Pausado. O figsom parou de atender os comandos, mas a conta continua conectada: clique em Retomar pra voltar, sem QR.')
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
    this.jidComigo = null
    try {
      await fs.rm(this.authDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (e) {
      this.log(`Não consegui apagar a pasta da sessão (${limparCaminhos(e.message)}). Apague ela à mão: ${limparCaminhos(this.authDir)}`, 'erro')
    }
  }

  // ---------- quem sou eu ----------
  // A própria conta tem dois endereços: o número (PN, "55...@s.whatsapp.net") e o LID ("...@lid").
  // Compara número E servidor (o areJidsSameUser do Baileys compara só o número).
  idsProprios(sock) {
    const ids = [sock?.user?.id, sock?.user?.lid, sock?.authState?.creds?.me?.id, sock?.authState?.creds?.me?.lid]
    return new Set(ids.filter(Boolean).map(jidNormalizedUser).filter(Boolean))
  }

  ehConversaComigo(sock, jid) {
    return !!jid && this.idsProprios(sock).has(jidNormalizedUser(jid))
  }

  // Pra onde vai a figurinha criada pelo computador: a conversa "Você".
  // De preferência o mesmo endereço em que os comandos chegam (PN ou LID); senão, o número da conta,
  // sem o ":aparelho" ("5511...:12@s.whatsapp.net" → "5511...@s.whatsapp.net").
  destinoProprio(sock) {
    if (this.jidComigo && this.ehConversaComigo(sock, this.jidComigo)) return this.jidComigo
    const id = sock?.user?.id || sock?.authState?.creds?.me?.id
    const jid = id ? jidNormalizedUser(id) : ''
    return jid && this.ehConversaComigo(sock, jid) ? jid : null
  }

  // ---------- memes ----------
  async carregarMeme(nome, opcoes) {
    if (!nomeSeguro(nome)) throw new ErroFigsom('nome', `Nome inválido: "${nome}". Use só o nome do arquivo que está na pasta de memes, sem pastas.`)
    const webpPronto = await acharArquivo(this.memesDir, nome, ['.webp'])
    const video = await acharArquivo(this.memesDir, nome, VIDEO)
    const audio = await acharArquivo(this.memesDir, nome, AUDIO)
    if (!webpPronto && !video) throw new ErroFigsom('meme', `Não achei "${nome}" na pasta de memes (vídeo ${VIDEO.join(' ')} ou .webp). Mande "!memes" pra ver a lista.`)
    const fonteAudio = audio || video
    if (!fonteAudio) throw new ErroFigsom('meme', `Não achei áudio pra "${nome}" (${AUDIO.join(' ')}).`)
    this.log('⚙️  Convertendo...')
    const ogg = await paraOgg(fonteAudio, opcoes)
    const webp = webpPronto ? await fs.readFile(webpPronto) : await paraWebp(video, opcoes)
    return { webp, ogg }
  }

  async listarMemes() {
    return (await listarBiblioteca(this.memesDir)).map((i) => i.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'))
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

  // ---------- baixar de links (X e TikTok) ----------
  mudarBaixador(situacao) {
    this.baixador = this.baixarLinks ? situacao : { estado: 'desligado', versao: situacao.versao }
    this.emit('baixador', this.baixador)
  }

  // Liga/desliga a chave "Baixar de links". Ligar baixa o componente (yt-dlp) se ainda não tiver.
  async definirBaixarLinks(ligado) {
    this.baixarLinks = !!ligado
    if (!this.baixarLinks) return this.mudarBaixador({ estado: 'desligado' })
    return this.prepararBaixador()
  }

  // Na abertura: se já está instalado, só confere o arquivo (sem internet); senão, baixa
  async conferirBaixador() {
    if (!this.baixarLinks) return this.mudarBaixador({ estado: 'desligado' })
    const { instalado, estado } = await this.componente.situacao()
    if (instalado) return this.mudarBaixador({ estado: 'pronto', versao: estado.versao })
    return this.prepararBaixador()
  }

  async prepararBaixador() {
    try {
      await this.componente.garantir()
    } catch (e) {
      this.log(`✖ ${this.mensagemDeErro(e)}`, 'erro')
    }
  }

  // Baixa só o trecho necessário pra dentro de dir. Devolve { arquivo, info }
  async baixarDoLink(link, { inicio, fim } = {}, dir, maxSeg) {
    const { url, site } = validarLink(link) // antes da chave: YouTube é recusado mesmo com ela desligada
    if (!this.baixarLinks) throw new ErroFigsom('baixador-desligado', `Baixar de links (X e TikTok) está desligado. ${this.dicaBaixador}`)
    const ffmpeg = acharNoPath(this.ffmpeg)
    if (!ffmpeg) throw new ErroFigsom('ffmpeg-ausente', 'ffmpeg não encontrado.')
    const { exe, impersonar } = await this.componente.garantir()
    this.log(`⬇️  Baixando do ${NOME_SITE[site]}...`)
    return baixarComYtDlp({
      exe, ffmpeg, url, site, inicio, fim, maxSeg, impersonar,
      pasta: path.join(dir, 'baixado'),
      timeout: maxSeg > LIMITE_SEG ? 240_000 : 150_000,
    })
  }

  async criarDoLink(link, opcoes = {}) {
    let webp, ogg
    await comPastaTemp(async (dir) => {
      const { arquivo } = await this.baixarDoLink(link, opcoes, dir, LIMITE_SEG)
      this.log('⚙️  Convertendo vídeo em figurinha + áudio...')
      const conv = { modo: opcoes.modo } // o trecho já foi aplicado no download
      try {
        ogg = await paraOgg(arquivo, conv)
        webp = await paraWebp(arquivo, conv)
      } catch (e) {
        if (e.codigo === 'sem-audio') {
          throw new ErroFigsom('sem-audio', 'Esse vídeo não tem som (todo "GIF" do X é um vídeo sem áudio). Dá pra guardar ele com "!salvar" e pôr na pasta de memes um áudio com o mesmo nome.')
        }
        if (e.codigo === 'vazio' && opcoes.fim != null) {
          throw new ErroFigsom('vazio', `Não sobrou nada no trecho ${opcoes.inicio || 0}-${opcoes.fim}s. Ele passa do fim do vídeo?`)
        }
        throw e
      }
    })
    return { webp, ogg }
  }

  // Baixa (até 60 s) pra pasta de memes. Nome: o pedido, ou o título do post; nunca sobrescreve.
  // Devolve { nome, pedido, semAudio }
  async salvarDeLink(link, nome, opcoes = {}) {
    const pedido = nome ? higienizarNome(nome) : null
    return comPastaTemp(async (dir) => {
      const { arquivo, info } = await this.baixarDoLink(link, opcoes, dir, LIMITE_SALVAR_SEG)
      const ext = path.extname(arquivo).toLowerCase()
      if (!VIDEO.includes(ext)) throw new ErroFigsom('formato', `O vídeo veio num formato que a pasta de memes não usa (${ext}).`)
      const { audio } = await inspecionar(arquivo).catch(() => ({ audio: true }))
      await fs.mkdir(this.memesDir, { recursive: true })
      const base = pedido || nomeDoTitulo(info)
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const final = await nomeLivre(this.memesDir, base)
        try {
          // COPYFILE_EXCL: se aparecer um arquivo com esse nome no meio do caminho, não sobrescreve
          await fs.copyFile(arquivo, path.join(this.memesDir, final + ext), fsConst.COPYFILE_EXCL)
        } catch (e) {
          if (e.code === 'EEXIST') continue
          throw e
        }
        this.log(`💾 Salvo na pasta de memes como "${final}".`, 'ok')
        this.emit('memes')
        return { nome: final, pedido: base, semAudio: !audio }
      }
      throw new ErroFigsom('nome', 'Não consegui achar um nome livre na pasta de memes.')
    })
  }

  // ---------- envio ----------
  lembrarEnviada(id, mensagem) {
    const agora = Date.now()
    for (const [k, v] of this.enviadas) if (agora - v.quando > GUARDAR_ENVIADAS_MS || this.enviadas.size > 50) this.enviadas.delete(k)
    this.enviadas.set(id, { mensagem, quando: agora })
  }

  async enviarParaMim(sock, jid, webp, ogg) {
    this.log('⬆️  Enviando...')
    const r = await enviarFigSom(sock, jid, webp, ogg, this.logger)
    this.lembrarEnviada(r.messageId, r.mensagem)
    this.log(`✅ Figurinha com som enviada! (${r.kb} KB, ${r.seconds}s) Toque nela e salve nas figurinhas.`, 'ok')
  }

  // Botão "Criar e enviar" do app: meme da pasta → figurinha na conversa "Você"
  async enviarDoPC(nome, opcoes = {}) {
    const sock = this.sock
    if (this.status !== 'conectado' || !sock) throw new ErroFigsom('desconectado', 'Conecte o WhatsApp antes de enviar.')
    const jid = this.destinoProprio(sock)
    if (!jid) throw new ErroFigsom('destino', 'Não consegui achar a conversa com você mesmo. Mande qualquer mensagem nela e tente de novo.')
    this.log(`🎬 Pedido do computador: ${this.descrever(nome, opcoes)}`)
    try {
      if (this.problemaFormato) throw new ErroFigsom('formato', `Envio desligado: ${this.problemaFormato}. Atualize o figsom.`)
      const { webp, ogg } = await this.carregarMeme(nome, opcoes)
      await this.enviarParaMim(sock, jid, webp, ogg)
    } catch (e) {
      this.log(`✖ ${this.mensagemDeErro(e)}`, 'erro')
      throw e
    }
  }

  mensagemDeErro(e) {
    if (e?.codigo === 'ffmpeg-ausente') return `ffmpeg não encontrado. ${this.dicaFfmpeg}`
    if (e instanceof ErroFigsom) return e.message
    const texto = String(e?.message || e)
    if (/Failed to fetch stream/i.test(texto) || [403, 404, 410].includes(e?.output?.statusCode)) {
      return 'Não consegui baixar o vídeo. Se ele for antigo, mande de novo e responda com "!criar".'
    }
    return limparCaminhos(texto)
  }

  // ---------- comandos ----------
  async responder(sock, jid, texto) {
    try {
      await sock.sendMessage(jid, { text: texto })
    } catch (e) {
      this.log(`Não consegui responder na conversa (${limparCaminhos(e.message)}).`, 'aviso')
    }
  }

  descreverLink(link) {
    try {
      return `link do ${NOME_SITE[validarLink(link).site]}`
    } catch {
      return 'link'
    }
  }

  descrever(origem, { modo, inicio, fim } = {}) {
    const trecho = fim != null ? `${inicio || 0}-${fim}s` : inicio > 0 ? `a partir de ${inicio}s` : ''
    return [origem, modo === 'ajustar' ? 'ajustar' : '', trecho].filter(Boolean).join(', ')
  }

  async tratarComando(sock, msg) {
    if (!msg.key.fromMe || this.jaVistos.has(msg.key.id)) return
    const jid = msg.key.remoteJid
    const comigo = this.ehConversaComigo(sock, jid)
    if (this.soConversaComigo && !comigo) return
    if (comigo) this.jidComigo = jidNormalizedUser(jid)
    const m = msg.message
    const cmd = interpretarComando(m?.conversation || m?.extendedTextMessage?.text || '')
    if (!cmd) return
    this.jaVistos.add(msg.key.id)
    if (this.jaVistos.size > 500) this.jaVistos.delete(this.jaVistos.values().next().value)

    if (cmd.comando === 'ajuda') {
      await this.responder(sock, jid, textoAjuda({ links: this.baixarLinks, dicaLinks: this.dicaBaixador }))
      this.log('📋 Lista de comandos enviada.')
      return this.reagir(sock, msg, '✅')
    }
    if (cmd.comando === 'memes') {
      const nomes = await this.listarMemes()
      await this.responder(sock, jid, nomes.length
        ? `🔊 memes:\n${nomes.join('\n')}\n\nPra usar: !criar nome`
        : 'A pasta de memes está vazia. Ponha vídeos nela, ou guarde um com "!salvar <link> nome".')
      this.log(`📋 Lista de memes enviada (${nomes.length}).`)
      return this.reagir(sock, msg, '✅')
    }
    // ⏳ enquanto trabalha; depois ✅ ou ❌ na própria mensagem do comando
    await this.reagir(sock, msg, '⏳')
    if (cmd.comando === 'salvar') {
      return this.reagir(sock, msg, (await this.atenderSalvar(sock, jid, cmd)) ? '✅' : '❌')
    }
    const ok = await this.atenderCriar(sock, msg, jid, cmd)
    if (ok && (await this.apagarPedidoSePreciso(sock, msg))) return
    return this.reagir(sock, msg, ok ? '✅' : '❌')
  }

  // Reage à mensagem do comando (aparece na conversa "Você", em todos os aparelhos)
  async reagir(sock, msg, emoji) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } })
    } catch (e) {
      this.log(`Não consegui reagir à mensagem (${limparCaminhos(e.message)}).`, 'aviso')
    }
  }

  async atenderSalvar(sock, jid, cmd) {
    this.log(`🎬 Pedido recebido: !salvar (${cmd.link ? this.descreverLink(cmd.link) : 'sem link'})`)
    try {
      if (cmd.erro) throw new ErroFigsom('uso', cmd.erro)
      const r = await this.salvarDeLink(cmd.link, cmd.nome, cmd.opcoes)
      const linhas = [`✅ Salvei na pasta de memes como *${r.nome}*.`]
      if (r.nome !== r.pedido) linhas.push(`(já tinha um "${r.pedido}", então usei outro nome)`)
      linhas.push(`Pra virar figurinha: !criar ${r.nome}`)
      if (r.semAudio) linhas.push(`⚠️ Esse vídeo não tem som. Ponha na pasta de memes um áudio com o mesmo nome (ex.: ${r.nome}.mp3).`)
      await this.responder(sock, jid, linhas.join('\n'))
      return true
    } catch (e) {
      const texto = this.mensagemDeErro(e)
      this.log(`✖ ${texto}`, 'erro')
      await this.responder(sock, jid, `⚠️ ${texto}`)
      return false
    }
  }

  async atenderCriar(sock, msg, jid, cmd) {
    const opcoes = cmd.opcoes || {}
    this.log(`🎬 Pedido recebido: !${cmd.palavra} (${this.descrever(cmd.link ? this.descreverLink(cmd.link) : cmd.nome || 'vídeo respondido', opcoes)})`)
    try {
      if (cmd.erro) throw new ErroFigsom('uso', cmd.erro)
      if (this.problemaFormato) throw new ErroFigsom('formato', `Envio desligado: ${this.problemaFormato}. Atualize o figsom.`)
      let webp, ogg
      const citada = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const videoCitado = citada?.videoMessage || citada?.ptvMessage
      if (cmd.link) {
        ;({ webp, ogg } = await this.criarDoLink(cmd.link, opcoes))
      } else if (cmd.nome) {
        ;({ webp, ogg } = await this.carregarMeme(cmd.nome, opcoes))
      } else if (videoCitado) {
        await comPastaTemp(async (dir) => {
          const tmp = path.join(dir, 'video.mp4')
          this.log('⬇️  Baixando o vídeo...')
          await this.baixarVideo(videoCitado, tmp)
          this.log('⚙️  Convertendo vídeo em figurinha + áudio...')
          // vídeos do WhatsApp são sempre MP4/MOV: força o formato em vez de deixar o ffmpeg adivinhar
          ogg = await paraOgg(tmp, { ...opcoes, formato: 'mov' })
          webp = await paraWebp(tmp, { ...opcoes, formato: 'mov' })
        })
      } else {
        throw new ErroFigsom('uso', 'Responda um VÍDEO com "!criar" (segure o vídeo → Responder), ou use "!criar nome" ou "!criar <link>".')
      }
      await this.enviarParaMim(sock, jid, webp, ogg)
      return true
    } catch (e) {
      const texto = this.mensagemDeErro(e)
      this.log(`✖ ${texto}`, 'erro')
      // quem manda link ou erra o comando geralmente está no celular: responde lá também
      if (cmd.link || cmd.erro) await this.responder(sock, jid, `⚠️ ${texto}`)
      return false
    }
  }

  // Apagar o comando é opcional (desligado por padrão): a reação ✅ já confirma
  async apagarPedidoSePreciso(sock, msg) {
    if (!this.apagarPedido) return false
    try {
      await sock.sendMessage(msg.key.remoteJid, { delete: msg.key })
      return true
    } catch (e) {
      this.log(`A figurinha foi enviada, mas não consegui apagar o comando (${limparCaminhos(e.message)}).`, 'aviso')
      return false
    }
  }
}
