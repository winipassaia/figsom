// Conversão com o ffmpeg de verdade (pula se não houver ffmpeg).
// Use FIGSOM_FFMPEG=/caminho/do/ffmpeg pra escolher qual testar.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { paraWebp, paraOgg, definirFfmpeg, segundosOgg, gerarMiniatura, inspecionar, comAssinatura, lerAssinatura } from '../src/enviar.js'
import { miniaturaComCache } from '../src/memes.js'

const FFMPEG = process.env.FIGSOM_FFMPEG || 'ffmpeg'
let temFfmpeg = true
try { execFileSync(FFMPEG, ['-hide_banner', '-version'], { stdio: 'ignore' }) } catch { temFfmpeg = false }
const opcoes = { skip: temFfmpeg ? false : 'ffmpeg não encontrado (defina FIGSOM_FFMPEG)' }

let dir, comAudio, semAudio
const gerar = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
const tempsDoFigsom = () => fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('figsom-') && !f.startsWith('figsom-teste-'))

before(() => {
  if (!temFfmpeg) return
  definirFfmpeg(FFMPEG)
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figsom-teste-'))
  comAudio = path.join(dir, 'com-audio.mp4')
  semAudio = path.join(dir, 'sem-audio.mp4')
  // encoders nativos do ffmpeg (mpeg4/aac): funcionam no build LGPL que vai no app
  gerar(['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '6', '-c:v', 'mpeg4', '-c:a', 'aac', '-shortest', comAudio])
  gerar(['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30', '-t', '4', '-c:v', 'mpeg4', semAudio])
})
after(() => dir && fs.rmSync(dir, { recursive: true, force: true }))

test('vídeo comum vira WebP animado + OGG com a duração do vídeo', opcoes, async () => {
  const webp = await paraWebp(comAudio)
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP')
  assert.ok(webp.includes(Buffer.from('ANIM')))
  const ogg = await paraOgg(comAudio)
  assert.ok(Math.abs(segundosOgg(ogg) - 6) < 0.5, `duração ${segundosOgg(ogg)}`)
})

test('formato forçado (mov), como nos vídeos baixados do WhatsApp', opcoes, async () => {
  const ogg = await paraOgg(comAudio, { formato: 'mov' })
  assert.ok(segundosOgg(ogg) > 5)
})

test('trecho 2-4 usa só 2 segundos', opcoes, async () => {
  const ogg = await paraOgg(comAudio, { inicio: 2, fim: 4 })
  assert.ok(Math.abs(segundosOgg(ogg) - 2) < 0.3, `duração ${segundosOgg(ogg)}`)
})

test('vídeo sem áudio dá erro claro', opcoes, async () => {
  await assert.rejects(paraOgg(semAudio), { codigo: 'sem-audio' })
})

test('trecho depois do fim do vídeo não gera figurinha vazia', opcoes, async () => {
  await assert.rejects(paraWebp(comAudio, { inicio: 50, fim: 55 }), { codigo: 'vazio' })
  await assert.rejects(paraOgg(comAudio, { inicio: 50, fim: 55 }), { codigo: 'vazio' })
})

test('trecho invertido é recusado', opcoes, async () => {
  await assert.rejects(paraOgg(comAudio, { inicio: 5, fim: 2 }), { codigo: 'trecho' })
  await assert.rejects(paraWebp(comAudio, { inicio: 3, fim: 3 }), { codigo: 'trecho' })
})

test('não deixa arquivos temporários pra trás (nem quando dá erro)', opcoes, async () => {
  const antes = new Set(tempsDoFigsom())
  await paraWebp(comAudio, { inicio: 1, fim: 2 })
  await paraOgg(semAudio).catch(() => {})
  await paraWebp(comAudio, { inicio: 50, fim: 55 }).catch(() => {})
  const sobraram = tempsDoFigsom().filter((f) => !antes.has(f))
  assert.deepEqual(sobraram, [])
})

test('erro do ffmpeg não mostra a pasta do usuário', opcoes, async () => {
  const inexistente = path.join(os.homedir(), 'figsom-nao-existe.mp4')
  const erro = await paraOgg(inexistente).catch((e) => e)
  assert.equal(erro.codigo, 'ffmpeg')
  assert.ok(!erro.message.includes(os.homedir()), erro.message)
})

test('miniatura: um quadro pequeno em WebP (parado)', opcoes, async () => {
  const mini = await gerarMiniatura(comAudio)
  assert.equal(mini.toString('ascii', 8, 12), 'WEBP')
  assert.ok(!mini.includes(Buffer.from('ANIM')))
  assert.ok(mini.length < 30_000, `${mini.length} bytes`)
})

test('miniatura com cache: a segunda vez não chama o ffmpeg', opcoes, async () => {
  const memesDir = path.join(dir, 'memes')
  const cacheDir = path.join(dir, 'cache')
  fs.mkdirSync(memesDir, { recursive: true })
  fs.copyFileSync(comAudio, path.join(memesDir, 'tome.mp4'))
  const a = await miniaturaComCache({ memesDir, cacheDir, nome: 'tome' })
  assert.equal(fs.readdirSync(cacheDir).length, 1)
  definirFfmpeg(path.join(dir, 'sem-ffmpeg'))
  try {
    const b = await miniaturaComCache({ memesDir, cacheDir, nome: 'tome' })
    assert.deepEqual(a, b)
  } finally {
    definirFfmpeg(FFMPEG)
  }
  assert.equal(await miniaturaComCache({ memesDir, cacheDir, nome: '../tome' }), null)
})

test('inspecionar: diz se o vídeo tem som', opcoes, async () => {
  const com = await inspecionar(comAudio)
  assert.deepEqual([com.video, com.audio], [true, true])
  assert.ok(Math.abs(com.duracao - 6) < 0.5)
  const sem = await inspecionar(semAudio)
  assert.deepEqual([sem.video, sem.audio], [true, false])
})

test('figurinha assinada decodifica igualzinho à original (mesmos quadros)', opcoes, async () => {
  const original = await paraWebp(comAudio, { inicio: 0, fim: 2 })
  const assinada = comAssinatura(original)
  assert.equal(lerAssinatura(assinada)['sticker-pack-name'], 'Criado pelo APP figsom')
  assert.ok(assinada.length - original.length < 400, 'a assinatura ocupa poucos bytes')
  const quadros = (buf, nome) => {
    const arq = path.join(dir, nome)
    fs.writeFileSync(arq, buf)
    return execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', arq, '-map', '0:v', '-f', 'framemd5', '-'], { encoding: 'utf8' })
      .split('\n').filter((l) => /^\s*0,/.test(l))
  }
  const a = quadros(original, 'original.webp')
  const b = quadros(assinada, 'assinada.webp')
  assert.ok(a.length > 0)
  assert.deepEqual(b, a)
})

test('ffmpeg ausente vira erro próprio', opcoes, async () => {
  definirFfmpeg(path.join(dir, 'ffmpeg-que-nao-existe'))
  try {
    await assert.rejects(paraOgg(comAudio), { codigo: 'ffmpeg-ausente' })
  } finally {
    definirFfmpeg(FFMPEG)
  }
})
