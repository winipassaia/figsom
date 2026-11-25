// captura.js — modo estudo: salva em disco as figurinhas recebidas (JSON + mídias)

import { downloadContentFromMessage, BufferJSON } from 'baileys'
import fs from 'node:fs/promises'
import path from 'node:path'

const IGNORAR = new Set(['protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo', 'reactionMessage'])

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

async function baixarMidia(midia, caminho, pastaSaida, idx, log) {
  for (const tipo of tiposCandidatos(caminho, midia.mimetype)) {
    try {
      const stream = await downloadContentFromMessage(midia, tipo)
      const partes = []
      for await (const p of stream) partes.push(p)
      const buf = Buffer.concat(partes)
      if (!buf.length) continue
      const nome = `${idx}_${caminho.replace(/[^\w.]/g, '_')}.${extensao(midia.mimetype, tipo)}`
      await fs.writeFile(path.join(pastaSaida, nome), buf)
      log(`   ⬇ ${nome} (${buf.length} bytes, chave=${tipo}, mime=${midia.mimetype || '?'})`)
      return
    } catch {
      // chave errada → tenta o próximo tipo
    }
  }
  log(`   ✖ não consegui baixar ${caminho}`)
}

export async function dissecar(msg, dumpDir, log) {
  const conteudo = msg.message
  if (!conteudo) return
  const tipos = Object.keys(conteudo).filter((k) => !IGNORAR.has(k))
  if (!tipos.length) return
  if (!tipos.some((t) => /sticker|sound/i.test(t))) return

  log(`📩 ${msg.pushName || msg.key.remoteJid} → [${tipos.join(', ')}]`)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const pasta = path.join(dumpDir, `${stamp}_${tipos[0]}`)
  await fs.mkdir(pasta, { recursive: true })
  await fs.writeFile(path.join(pasta, 'mensagem.json'), JSON.stringify(msg, BufferJSON.replacer, 2))

  const midias = acharMidias(conteudo)
  let i = 0
  for (const { caminho, midia } of midias) await baixarMidia(midia, caminho, pasta, i++, log)
  log(`   💾 salvo em ${pasta}`)
}
