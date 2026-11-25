// enviar.js — monta e envia figurinhas com som no formato descoberto:
//   Message.134 (FutureProofMessage) → .1 Message → .26 stickerMessage → .26 AudioMessage

import { proto, prepareWAMessageMedia, generateMessageIDV2 } from 'baileys'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const run = promisify(execFile)
export const SOM = Symbol('figSom')
const LIMITE_SEG = 10 // maior duração vista nas figurinhas oficiais
const LIMITE_WEBP = 1_000_000 // as oficiais chegaram a ~950 KB

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

export function instalarGanchoEncode() {
  const original = proto.Message.encode
  proto.Message.encode = function (m, w) {
    const out = original.call(this, m, w)
    if (m && m[SOM]) out.uint32((134 << 3) | 2).bytes(montarCampo134(m[SOM]))
    return out
  }
}

// O stickerMessage fica no PROTÓTIPO: o Baileys enxerga (marca a mensagem como mídia/sticker),
// mas o encode ignora (só codifica propriedades próprias) → não sai duplicado no topo.
export function montarMensagem(sticker, audio) {
  const msg = Object.create({ stickerMessage: sticker })
  msg.messageContextInfo = { messageSecret: randomBytes(32) }
  msg[SOM] = { sticker, audio }
  return msg
}

// ---------- mídia ----------
export function duracaoOgg(buf) {
  // última página Ogg → granule position; OpusHead → pre-skip; Opus usa clock de 48 kHz
  const head = buf.indexOf('OpusHead')
  const preSkip = head >= 0 ? buf.readUInt16LE(head + 10) : 0
  const ultima = buf.lastIndexOf('OggS')
  if (ultima < 0) return 0
  const granule = Number(buf.readBigUInt64LE(ultima + 6))
  return Math.max(1, Math.round((granule - preSkip) / 48000))
}

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

async function ffmpeg(args) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 })
}

export async function paraWebp(entrada) {
  const saida = path.join(os.tmpdir(), `fig_${Date.now()}.webp`)
  for (const q of [70, 50, 35, 20]) {
    await ffmpeg([
      '-i', entrada, '-t', String(LIMITE_SEG), '-an',
      '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
      '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(q), '-loop', '0', '-preset', 'picture',
      saida,
    ])
    const buf = await fs.readFile(saida)
    if (buf.length <= LIMITE_WEBP) return buf
    console.log(`   webp com ${(buf.length / 1024) | 0} KB, reduzindo qualidade...`)
  }
  return fs.readFile(saida)
}

export async function paraOgg(entrada) {
  const saida = path.join(os.tmpdir(), `som_${Date.now()}.ogg`)
  await ffmpeg(['-i', entrada, '-vn', '-t', String(LIMITE_SEG), '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', saida])
  return fs.readFile(saida)
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

  const msg = montarMensagem(stickerMessage, audioMessage)
  const messageId = generateMessageIDV2(sock.user?.id)
  await sock.relayMessage(jid, msg, { messageId })
  return { messageId, seconds, kb: (webp.length / 1024) | 0 }
}
