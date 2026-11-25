// raw.js — captura os bytes crus de cada mensagem ANTES do Baileys decodificar,
// e um decodificador protobuf "cego" (igual ao protoc --decode_raw) pra ver campos desconhecidos.

import { proto, downloadContentFromMessage } from 'baileys'
import fs from 'node:fs'
import path from 'node:path'

const RAW_DIR = path.join('dumps', 'raw')

// ---------- decodificador protobuf cru ----------
function lerVarint(buf, pos) {
  let res = 0n, shift = 0n
  while (true) {
    if (pos >= buf.length) throw new Error('varint truncado')
    const b = buf[pos++]
    res |= BigInt(b & 0x7f) << shift
    if (!(b & 0x80)) break
    shift += 7n
  }
  return [res, pos]
}

function pareceTexto(b) {
  if (!b.length) return false
  let ok = 0
  for (const c of b) if ((c >= 0x20 && c < 0x7f) || c === 10 || c === 13 || c === 9) ok++
  return ok / b.length > 0.9
}

// Tenta decodificar como mensagem protobuf; retorna lista de campos ou null
export function decodeRaw(buf, profundidade = 0) {
  if (profundidade > 12) return null
  const campos = []
  let pos = 0
  try {
    while (pos < buf.length) {
      let tag
      ;[tag, pos] = lerVarint(buf, pos)
      const num = Number(tag >> 3n), wt = Number(tag & 7n)
      if (num === 0) return null
      if (wt === 0) {
        let v; [v, pos] = lerVarint(buf, pos)
        campos.push({ num, tipo: 'varint', valor: v.toString() })
      } else if (wt === 1) {
        if (pos + 8 > buf.length) return null
        campos.push({ num, tipo: 'fixed64', valor: buf.readBigUInt64LE(pos).toString() }); pos += 8
      } else if (wt === 5) {
        if (pos + 4 > buf.length) return null
        campos.push({ num, tipo: 'fixed32', valor: buf.readUInt32LE(pos) }); pos += 4
      } else if (wt === 2) {
        let len; [len, pos] = lerVarint(buf, pos)
        len = Number(len)
        if (pos + len > buf.length) return null
        const sub = buf.subarray(pos, pos + len); pos += len
        const filhos = !pareceTexto(sub) && sub.length ? decodeRaw(sub, profundidade + 1) : null
        if (filhos) campos.push({ num, tipo: 'msg', len, filhos })
        else if (pareceTexto(sub)) campos.push({ num, tipo: 'texto', valor: sub.toString('utf8') })
        else campos.push({ num, tipo: 'bytes', len, hex: sub.subarray(0, 32).toString('hex') + (len > 32 ? '…' : '') })
      } else return null
    }
  } catch { return null }
  return campos
}

export function imprimir(campos, ind = '') {
  const linhas = []
  for (const c of campos) {
    if (c.tipo === 'msg') { linhas.push(`${ind}${c.num} {  (${c.len} bytes)`); linhas.push(imprimir(c.filhos, ind + '  ')); linhas.push(`${ind}}`) }
    else if (c.tipo === 'texto') linhas.push(`${ind}${c.num}: "${c.valor.length > 200 ? c.valor.slice(0, 200) + '…' : c.valor}"`)
    else if (c.tipo === 'bytes') linhas.push(`${ind}${c.num}: <${c.len} bytes> ${c.hex}`)
    else linhas.push(`${ind}${c.num}: ${c.valor}  (${c.tipo})`)
  }
  return linhas.join('\n')
}

// ---------- gancho no proto.Message.decode ----------
const IGNORAR = new Set(['messageContextInfo', 'senderKeyDistributionMessage', 'protocolMessage', 'reactionMessage', 'deviceSentMessage'])

export function instalarGancho() {
  fs.mkdirSync(RAW_DIR, { recursive: true })
  const original = proto.Message.decode
  proto.Message.decode = function (entrada, ...resto) {
    const msg = original.call(this, entrada, ...resto)
    // só a chamada de topo (Buffer/Uint8Array); chamadas internas recebem um Reader
    if (!(entrada instanceof Uint8Array)) return msg
    try {
      const raiz = msg.deviceSentMessage?.message || msg
      const chaves = Object.keys(raiz).filter((k) => !IGNORAR.has(k))
      const vazia = chaves.length === 0
      const figurinha = chaves.some((k) => /sticker|sound/i.test(k))
      if (vazia || figurinha) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const base = path.join(RAW_DIR, `${stamp}_${vazia ? 'DESCONHECIDA' : chaves[0]}`)
        const buf = Buffer.from(entrada)
        fs.writeFileSync(base + '.bin', buf)
        const arvore = decodeRaw(buf)
        fs.writeFileSync(base + '.txt', arvore ? imprimir(arvore) : '(não decodificou)')
        console.log(`\n🧬 bytes crus (${buf.length} B) → ${base}.txt  ${vazia ? '⚠ tipo DESCONHECIDO pro Baileys!' : ''}`)
        const figSom = extrairFigSom(buf)
        if (figSom) baixarFigSom(figSom, stamp).catch((e) => console.error('   ✖ download falhou:', e.message))
      }
    } catch (e) {
      console.error('gancho raw falhou:', e.message)
    }
    return msg
  }
}

// ---------- extração da figurinha com som ----------
// Estrutura descoberta:
//   Message.134 (FutureProofMessage, campo novo) → .1 Message → .26 stickerMessage → .26 AudioMessage (campo novo)
//   Quando enviada por outro aparelho teu, vem embrulhada em deviceSentMessage (31) → .2 Message
function camposCrus(buf) {
  const out = []
  let pos = 0
  while (pos < buf.length) {
    let tag; [tag, pos] = lerVarint(buf, pos)
    const num = Number(tag >> 3n), wt = Number(tag & 7n)
    const ini = pos
    if (wt === 0) [, pos] = lerVarint(buf, pos)
    else if (wt === 1) pos += 8
    else if (wt === 5) pos += 4
    else if (wt === 2) { let len; [len, pos] = lerVarint(buf, pos); const s = pos; pos += Number(len); out.push({ num, wt, bytes: buf.subarray(s, pos) }); continue }
    else throw new Error('wire type inválido')
    out.push({ num, wt, bytes: buf.subarray(ini, pos) })
  }
  return out
}
const pegar = (buf, num) => camposCrus(buf).find((c) => c.num === num && c.wt === 2)?.bytes

export function extrairFigSom(buf) {
  let msg = Buffer.from(buf)
  const ds = pegar(msg, 31)
  if (ds) msg = pegar(ds, 2) || msg
  const fp = pegar(msg, 134)
  if (!fp) return null
  const interna = pegar(fp, 1)
  const stickerBytes = interna && pegar(interna, 26)
  if (!stickerBytes) return null
  const audioBytes = pegar(stickerBytes, 26)
  return {
    sticker: proto.Message.StickerMessage.decode(stickerBytes),
    audio: audioBytes ? proto.Message.AudioMessage.decode(audioBytes) : null,
  }
}

async function baixar(midia, tipo) {
  const stream = await downloadContentFromMessage(midia, tipo)
  const partes = []
  for await (const p of stream) partes.push(p)
  return Buffer.concat(partes)
}

async function baixarFigSom({ sticker, audio }, stamp) {
  const pasta = path.join('dumps', 'figsom', stamp)
  fs.mkdirSync(pasta, { recursive: true })
  console.log(`🔊 FIGURINHA COM SOM! áudio ${audio?.seconds ?? '?'}s (${audio?.mimetype})`)
  const webp = await baixar(sticker, 'sticker')
  fs.writeFileSync(path.join(pasta, 'fig.webp'), webp)
  console.log(`   ⬇ fig.webp (${webp.length} B)`)
  if (audio) {
    const ogg = await baixar(audio, 'audio')
    fs.writeFileSync(path.join(pasta, 'som.ogg'), ogg)
    console.log(`   ⬇ som.ogg (${ogg.length} B)`)
  }
  const info = {
    sticker: { mimetype: sticker.mimetype, width: sticker.width, height: sticker.height, isAnimated: sticker.isAnimated, fileLength: Number(sticker.fileLength), firstFrameLength: sticker.firstFrameLength },
    audio: audio && { mimetype: audio.mimetype, seconds: audio.seconds, ptt: audio.ptt, fileLength: Number(audio.fileLength), temWaveform: !!audio.waveform?.length },
  }
  fs.writeFileSync(path.join(pasta, 'info.json'), JSON.stringify(info, null, 2))
  console.log(`   💾 ${pasta}/`)
}
