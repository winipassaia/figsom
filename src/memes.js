// memes.js — pasta de memes: nomes seguros, listagem, nomes novos (sem sobrescrever) e miniaturas.

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gerarMiniatura } from './enviar.js'

export const VIDEO = ['.mp4', '.mov', '.webm', '.mkv', '.gif', '.avi']
export const AUDIO = ['.ogg', '.opus', '.mp3', '.m4a', '.wav', '.aac', '.flac']
const TAMANHO_NOME = 40
// nomes que o Windows não deixa usar como arquivo
const RESERVADO = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i

// Nome de meme: só o nome do arquivo, sem pastas (evita "!criar ../../alguma-coisa")
export const nomeSeguro = (n) =>
  typeof n === 'string' && !!n && n === path.basename(n) && !/[\\/:]/.test(n) && !n.startsWith('.')

// Deixa um nome digitável no celular e seguro como nome de arquivo:
// "Não Acredito!! 😂 #fyp" → "nao-acredito". Só letras sem acento, números e "-".
export function higienizarNome(texto, { tamanho = TAMANHO_NOME } = {}) {
  let n = String(texto ?? '')
    .normalize('NFKD').replace(/\p{M}/gu, '') // tira acentos
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@]\S+/g, ' ') // hashtags e menções
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (n.length > tamanho) {
    n = n.slice(0, tamanho)
    const corte = n.lastIndexOf('-')
    if (corte >= tamanho / 3) n = n.slice(0, corte) // corta numa palavra inteira, se der
    n = n.replace(/-+$/, '')
  }
  if (!n) return 'video'
  return RESERVADO.test(n) ? `${n}-meme` : n
}

// Nome a partir do título que o site devolve, curto pra digitar no celular (até 4 palavras).
// No X o título vem como "Autor - texto do post".
export function nomeDoTitulo({ title, uploader } = {}) {
  let t = String(title ?? '')
  if (uploader && t.startsWith(`${uploader} - `)) t = t.slice(uploader.length + 3)
  if (/^TikTok video #\d+$/i.test(t)) t = '' // TikTok sem legenda
  return higienizarNome(higienizarNome(t).split('-').slice(0, 4).join('-'), { tamanho: 28 })
}

async function nomesNaPasta(memesDir) {
  try {
    return (await fs.readdir(memesDir)).map((f) => path.parse(f).name.toLowerCase())
  } catch {
    return []
  }
}

// Primeiro nome livre: "gato", "gato-2", "gato-3"... (sem sobrescrever nada, em qualquer extensão)
export async function nomeLivre(memesDir, base) {
  const usados = new Set(await nomesNaPasta(memesDir))
  if (!usados.has(base.toLowerCase())) return base
  for (let i = 2; i < 1000; i++) {
    const n = `${base}-${i}`
    if (!usados.has(n.toLowerCase())) return n
  }
  throw new Error('nomes esgotados')
}

// Acha "nome" + uma das extensões (na ordem de preferência), sem ligar pra maiúsculas na extensão
export async function acharArquivo(memesDir, nome, exts) {
  let arquivos
  try {
    arquivos = await fs.readdir(memesDir)
  } catch {
    return null
  }
  for (const e of exts) {
    const achado = arquivos.find((f) => {
      const p = path.parse(f)
      return p.name === nome && p.ext.toLowerCase() === e
    })
    if (achado) return path.join(memesDir, achado)
  }
  return null
}

// Itens da pasta de memes, mais novos primeiro:
//   { nome, tipo: 'video'|'webp'|'audio', audioSeparado, usavel, mtimeMs }
export async function listarBiblioteca(memesDir) {
  await fs.mkdir(memesDir, { recursive: true })
  const itens = new Map()
  for (const d of await fs.readdir(memesDir, { withFileTypes: true })) {
    if (!d.isFile() || d.name.startsWith('.')) continue
    const { name: nome, ext } = path.parse(d.name)
    const e = ext.toLowerCase()
    const tipo = e === '.webp' ? 'webp' : VIDEO.includes(e) ? 'video' : AUDIO.includes(e) ? 'audio' : null
    if (!tipo || !nomeSeguro(nome)) continue
    let mtimeMs = 0
    try { mtimeMs = (await fs.stat(path.join(memesDir, d.name))).mtimeMs } catch {}
    const item = itens.get(nome) ?? { nome, webp: false, video: false, audio: false, mtimeMs: 0 }
    item[tipo] = true
    item.mtimeMs = Math.max(item.mtimeMs, mtimeMs)
    itens.set(nome, item)
  }
  return [...itens.values()]
    .map((i) => ({
      nome: i.nome,
      tipo: i.webp ? 'webp' : i.video ? 'video' : 'audio',
      audioSeparado: i.audio,
      // .webp precisa de áudio separado; vídeo pode usar o som dele mesmo
      usavel: i.webp ? i.audio : i.video,
      mtimeMs: i.mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ---------- miniaturas ----------
// Arquivo que vira miniatura: a figurinha pronta (.webp) ou o vídeo
export const arquivoDaMiniatura = (memesDir, nome) => acharArquivo(memesDir, nome, ['.webp', ...VIDEO])

// Cache por nome + data de modificação + tamanho: mudou o arquivo, gera de novo
export function chaveMiniatura(arquivo, { mtimeMs, size }) {
  return createHash('sha1').update(`${path.basename(arquivo)}|${mtimeMs}|${size}`).digest('hex')
}

export async function miniaturaComCache({ memesDir, cacheDir, nome }) {
  if (!nomeSeguro(nome)) return null
  const fonte = await arquivoDaMiniatura(memesDir, nome)
  if (!fonte) return null
  const cache = path.join(cacheDir, `${chaveMiniatura(fonte, await fs.stat(fonte))}.webp`)
  try {
    return await fs.readFile(cache)
  } catch {}
  const buf = await gerarMiniatura(fonte)
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(cache, buf)
  return buf
}

// Apaga do cache as miniaturas de arquivos que não existem mais (ou mudaram)
export async function limparMiniaturas({ memesDir, cacheDir }) {
  let cache
  try {
    cache = await fs.readdir(cacheDir)
  } catch {
    return
  }
  const validas = new Set()
  for (const f of await fs.readdir(memesDir).catch(() => [])) {
    const p = path.join(memesDir, f)
    try { validas.add(`${chaveMiniatura(p, await fs.stat(p))}.webp`) } catch {}
  }
  await Promise.all(cache.filter((f) => !validas.has(f)).map((f) => fs.rm(path.join(cacheDir, f), { force: true }).catch(() => {})))
}
