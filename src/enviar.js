// enviar.js — monta e envia figurinhas com som no formato descoberto:
//   Message.134 (FutureProofMessage) → .1 Message → .26 stickerMessage → .26 AudioMessage

import { proto, prepareWAMessageMedia, generateMessageIDV2 } from 'baileys'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { decodeRaw, extrairFigSom } from './raw.js'

const run = promisify(execFile)
let FFMPEG = 'ffmpeg'
export function definirFfmpeg(caminho) {
  if (caminho) FFMPEG = caminho
}
export const SOM = Symbol('figSom')
const LIMITE_SEG = 10 // maior duração vista nas figurinhas oficiais
const LIMITE_WEBP = 1_000_000 // as oficiais chegaram a ~950 KB
const LIMITE_TEMPO_MS = 120_000 // uma conversão nunca deveria passar disso

// Erro com mensagem já pronta pra mostrar ao usuário (sem caminhos nem saída crua do ffmpeg)
export class ErroFigsom extends Error {
  constructor(codigo, mensagem) {
    super(mensagem)
    this.codigo = codigo
  }
}

// Tira caminhos do computador (que mostram o nome do usuário) de mensagens de erro
export function limparCaminhos(texto) {
  return String(texto ?? '')
    .replace(/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"']+/gi, '~')
    .replace(/\/(?:home|Users)\/[^/\s"']+/g, '~')
}

// ---------- gancho no encode: escreve o campo 134 que o Baileys não conhece ----------
function writer() {
  return proto.Message.FutureProofMessage.encode({}) // writer vazio
}

export function montarCampo134({ sticker, audio }) {
  const audioBytes = proto.Message.AudioMessage.encode(audio).finish()
  const stickerBytes = proto.Message.StickerMessage.encode(sticker).uint32((26 << 3) | 2).bytes(audioBytes).finish()
  const interna = writer().uint32((26 << 3) | 2).bytes(stickerBytes).finish() // Message{ stickerMessage }
  return writer().uint32((1 << 3) | 2).bytes(interna).finish() // FutureProofMessage{ message }
}

let ganchoInstalado = false
export function instalarGanchoEncode() {
  if (ganchoInstalado) return // instalar duas vezes escreveria o campo 134 em dobro
  ganchoInstalado = true
  const original = proto.Message.encode
  proto.Message.encode = function (m, w) {
    const out = original.call(this, m, w)
    if (m && m[SOM]) out.uint32((134 << 3) | 2).bytes(montarCampo134(m[SOM]))
    return out
  }
}

// O stickerMessage fica no PROTÓTIPO: o Baileys enxerga (marca a mensagem como mídia/sticker),
// mas o encode ignora (só codifica propriedades próprias) → não sai duplicado no topo.
// Atenção: qualquer cópia do objeto (fromObject, JSON, {...msg}) perde o formato. Por isso o
// cache de reenvio (getMessage, no bot.js) guarda e devolve o PRÓPRIO objeto.
export function montarMensagem(sticker, audio) {
  const msg = Object.create({ stickerMessage: sticker })
  msg.messageContextInfo = { messageSecret: randomBytes(32) }
  msg[SOM] = { sticker, audio }
  return msg
}

// Autoteste: confere se, com esta versão do Baileys, o gancho ainda gera o formato certo
// (no topo e dentro do deviceSentMessage que vai pros seus outros aparelhos).
// Devolve null se estiver tudo certo, ou o motivo do problema.
export function conferirFormato() {
  try {
    const sticker = { url: 'https://x', mimetype: 'image/webp', mediaKey: Buffer.alloc(32, 1), isAnimated: true }
    const audio = { url: 'https://y', mimetype: 'audio/ogg; codecs=opus', seconds: 1, mediaKey: Buffer.alloc(32, 2) }
    const msg = montarMensagem(sticker, audio)
    if (!msg.stickerMessage) return 'o stickerMessage não está visível no objeto'
    const topo = Buffer.from(proto.Message.encode(msg).finish())
    const campos = (decodeRaw(topo) || []).map((c) => c.num)
    if (!campos.includes(134)) return 'o campo 134 não foi escrito (o gancho no encode não pegou)'
    if (campos.includes(26)) return 'o stickerMessage saiu duplicado no topo da mensagem'
    if (!extrairFigSom(topo)?.audio) return 'o áudio não está dentro da figurinha'
    const dsm = Buffer.from(proto.Message.encode({ deviceSentMessage: { destinationJid: '0@s.whatsapp.net', message: msg } }).finish())
    if (!extrairFigSom(dsm)?.audio) return 'o formato some dentro do deviceSentMessage'
    return null
  } catch (e) {
    return e.message
  }
}

// ---------- mídia ----------
// Segundos de áudio de um OGG/Opus (0 se não tiver nenhum pacote de áudio)
export function segundosOgg(buf) {
  // última página Ogg → granule position; OpusHead → pre-skip; Opus usa clock de 48 kHz
  const head = buf.indexOf('OpusHead')
  const preSkip = head >= 0 && head + 12 <= buf.length ? buf.readUInt16LE(head + 10) : 0
  const ultima = buf.lastIndexOf('OggS')
  if (ultima < 0 || ultima + 14 > buf.length) return 0
  const granule = Number(buf.readBigUInt64LE(ultima + 6))
  return Math.max(0, (granule - preSkip) / 48000)
}

export function duracaoOgg(buf) {
  return Math.max(1, Math.round(segundosOgg(buf)))
}

const ehWebp = (buf) => buf.length > 64 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP'

function webpInfo(buf) {
  const animada = buf.includes(Buffer.from('ANIM'))
  let w = 512, h = 512
  const vp8x = buf.indexOf('VP8X')
  if (vp8x >= 0) {
    w = 1 + buf.readUIntLE(vp8x + 12, 3)
    h = 1 + buf.readUIntLE(vp8x + 15, 3)
  }
  return { animada, w, h }
}

// Pasta temporária própria (nome imprevisível), sempre apagada no fim
export async function comPastaTemp(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'figsom-'))
  try {
    return await fn(dir)
  } finally {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {})
  }
}

async function ffmpeg(args) {
  try {
    await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      maxBuffer: 1 << 26,
      windowsHide: true,
      timeout: LIMITE_TEMPO_MS,
      killSignal: 'SIGKILL',
    })
  } catch (e) {
    if (e.code === 'ENOENT') throw new ErroFigsom('ffmpeg-ausente', 'ffmpeg não encontrado.')
    if (e.killed) throw new ErroFigsom('ffmpeg-tempo', 'A conversão demorou demais e foi cancelada.')
    const stderr = String(e.stderr || '')
    if (/does not contain any stream|matches no streams/i.test(stderr)) throw new ErroFigsom('sem-stream', 'arquivo sem a faixa necessária')
    const linhas = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const motivo = linhas.find((l) => /invalid|error|could not|no such|failed|unsupported/i.test(l)) || linhas.at(-1) || `código ${e.code}`
    throw new ErroFigsom('ffmpeg', `O ffmpeg não conseguiu converter: ${limparCaminhos(motivo)}`)
  }
}

// Entrada pro ffmpeg: só arquivos locais (nada de http, playlists apontando pra fora etc.)
// e, quando informado, o formato forçado (ex.: 'mov' pros vídeos baixados do WhatsApp).
function argsEntrada(entrada, formato) {
  return ['-protocol_whitelist', 'file', ...(formato ? ['-f', formato] : []), '-i', entrada]
}

// Trecho do vídeo: { inicio, fim } em segundos (opcional). Sempre limitado a LIMITE_SEG.
function argsTrecho({ inicio, fim } = {}) {
  const ini = inicio > 0 ? inicio : 0
  if (fim != null && !(fim > ini)) {
    throw new ErroFigsom('trecho', `Trecho inválido: o fim (${fim}s) precisa vir depois do início (${ini}s). Exemplo: !som 2-6`)
  }
  const args = []
  if (ini > 0) args.push('-ss', String(ini))
  args.push('-t', String(fim != null ? Math.min(fim - ini, LIMITE_SEG) : LIMITE_SEG))
  return args
}

const FILTRO = {
  // padrão: preenche o quadrado e corta as sobras (centro do vídeo)
  cortar: 'fps=15,scale=512:512:force_original_aspect_ratio=increase,crop=512:512,format=rgba',
  // "ajustar": vídeo inteiro dentro do quadrado, sobras transparentes
  ajustar: 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
}

const foraDoVideo = ({ inicio, fim } = {}, oque) =>
  fim != null
    ? `Não sobrou nada no trecho ${inicio || 0}-${fim}s. Ele passa do fim do vídeo?`
    : `Não consegui gerar ${oque} a partir desse arquivo.`

export async function paraWebp(entrada, { modo = 'cortar', formato, ...trecho } = {}) {
  const argsT = argsTrecho(trecho)
  return comPastaTemp(async (dir) => {
    const saida = path.join(dir, 'fig.webp')
    let buf
    for (const q of [70, 50, 35, 20]) {
      try {
        await ffmpeg([
          ...argsT, ...argsEntrada(entrada, formato), '-an',
          '-vf', FILTRO[modo] || FILTRO.cortar,
          '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(q), '-loop', '0', '-preset', 'picture',
          saida,
        ])
      } catch (e) {
        if (e.codigo === 'sem-stream') throw new ErroFigsom('sem-video', 'Esse arquivo não tem imagem de vídeo.')
        throw e
      }
      buf = await fs.readFile(saida).catch(() => Buffer.alloc(0))
      if (!ehWebp(buf)) throw new ErroFigsom('vazio', foraDoVideo(trecho, 'a figurinha'))
      if (buf.length <= LIMITE_WEBP) return buf
      console.log(`   webp com ${(buf.length / 1024) | 0} KB, reduzindo qualidade...`)
    }
    return buf
  })
}

export async function paraOgg(entrada, { formato, ...trecho } = {}) {
  const argsT = argsTrecho(trecho)
  return comPastaTemp(async (dir) => {
    const saida = path.join(dir, 'som.ogg')
    try {
      await ffmpeg([...argsT, ...argsEntrada(entrada, formato), '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', saida])
    } catch (e) {
      if (e.codigo === 'sem-stream') {
        throw new ErroFigsom('sem-audio', 'Esse vídeo não tem áudio. Use um vídeo com som, ou ponha na pasta de memes um áudio com o mesmo nome do arquivo.')
      }
      throw e
    }
    const buf = await fs.readFile(saida).catch(() => Buffer.alloc(0))
    if (segundosOgg(buf) < 0.05) throw new ErroFigsom('vazio', foraDoVideo(trecho, 'o áudio'))
    return buf
  })
}

// ---------- envio ----------
export async function enviarFigSom(sock, jid, webp, ogg, logger) {
  const { animada, w, h } = webpInfo(webp)
  const seconds = duracaoOgg(ogg)
  const up = { upload: sock.waUploadToServer, logger }

  const { stickerMessage } = await prepareWAMessageMedia(
    { sticker: webp, mimetype: 'image/webp', isAnimated: animada, width: w, height: h },
    up,
  )
  const { audioMessage } = await prepareWAMessageMedia(
    { audio: ogg, mimetype: 'audio/ogg; codecs=opus', seconds },
    up,
  )

  const mensagem = montarMensagem(stickerMessage, audioMessage)
  const messageId = generateMessageIDV2(sock.user?.id)
  await sock.relayMessage(jid, mensagem, { messageId })
  return { messageId, mensagem, seconds, kb: (webp.length / 1024) | 0 }
}
