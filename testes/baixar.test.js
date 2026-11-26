// Baixador (yt-dlp) sem internet: links aceitos, argumentos, erros e o componente
// conferido pelo SHA-256 (com um "GitHub" falso e arquivos falsos locais).
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  validarLink, argsYtDlp, EXTRACTORS, traduzirErroYtDlp, lerSomas, nomeDoExecutavel, ComponenteYtDlp, REPO,
} from '../src/baixar.js'
import { higienizarNome, nomeDoTitulo, nomeLivre, nomeSeguro } from '../src/memes.js'

// ---------- links ----------
test('aceita só os hosts do X e do TikTok, já normalizados', () => {
  const casos = {
    'https://x.com/a/status/1': ['https://x.com/a/status/1', 'x'],
    'https://www.x.com/a/status/1?s=20&t=abc': ['https://www.x.com/a/status/1', 'x'],
    'http://mobile.x.com/a/status/1#frag': ['https://mobile.x.com/a/status/1', 'x'],
    'https://twitter.com/a/status/1/video/1': ['https://twitter.com/a/status/1/video/1', 'x'],
    'https://www.twitter.com/a/status/1': ['https://www.twitter.com/a/status/1', 'x'],
    'https://mobile.twitter.com/a/status/1': ['https://mobile.twitter.com/a/status/1', 'x'],
    'https://www.tiktok.com/@a/video/7?is_from_webapp=1': ['https://www.tiktok.com/@a/video/7', 'tiktok'],
    'https://tiktok.com/@a/video/7': ['https://www.tiktok.com/@a/video/7', 'tiktok'],
    'https://vm.tiktok.com/ZMabc/': ['https://vm.tiktok.com/ZMabc/', 'tiktok'],
    'https://vt.tiktok.com/ZSabc': ['https://vt.tiktok.com/ZSabc', 'tiktok'],
    'vm.tiktok.com/ZMabc/': ['https://vm.tiktok.com/ZMabc/', 'tiktok'],
    'HTTPS://X.COM/a/status/1': ['https://x.com/a/status/1', 'x'],
  }
  for (const [entrada, [url, site]] of Object.entries(casos)) {
    assert.deepEqual(validarLink(entrada), { url, site }, entrada)
  }
})

test('YouTube é recusado com mensagem própria', () => {
  for (const l of ['https://www.youtube.com/watch?v=x', 'https://youtu.be/x', 'https://m.youtube.com/shorts/x', 'music.youtube.com/watch?v=x']) {
    assert.throws(() => validarLink(l), (e) => e.codigo === 'link-youtube' && /YouTube não é suportado/.test(e.message), l)
  }
})

test('outros links são recusados (citando que YouTube também não vale)', () => {
  const ruins = [
    'https://instagram.com/p/x', 'https://x.com.golpe.com/a/status/1', 'https://golpex.com/a/status/1',
    'https://golpe.com/x.com/a/status/1', 'https://m.tiktok.com/v/1', 'https://tiktok.com.br/@a/video/1',
  ]
  for (const l of ruins) {
    assert.throws(() => validarLink(l), (e) => e.codigo === 'link-site' && /YouTube também não/.test(e.message), l)
  }
  for (const l of ['https://x.com@golpe.com/a', 'https://usuario:senha@x.com/a/status/1', 'https://x.com:8443/a/status/1',
    'javascript:alert(1)', 'file:///etc/passwd', 'ftp://x.com/a', '', 'https://', `https://x.com/${'a'.repeat(3000)}`]) {
    assert.throws(() => validarLink(l), (e) => e.codigo?.startsWith('link'), l)
  }
})

// ---------- argumentos ----------
const base = { url: 'https://x.com/a/status/1', ffmpeg: path.join('C:', 'ff', 'ffmpeg.exe'), pasta: path.join(os.tmpdir(), 'figsom-x', 'baixado') }
const valor = (args, opcao) => args[args.indexOf(opcao) + 1]

test('argumentos do yt-dlp: travas de segurança e o link sempre depois do "--"', () => {
  const a = argsYtDlp(base)
  for (const o of ['--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-cache-dir']) assert.ok(a.includes(o), o)
  assert.equal(valor(a, '--playlist-items'), '1')
  assert.equal(valor(a, '--use-extractors'), EXTRACTORS.join(','))
  assert.deepEqual(EXTRACTORS, ['twitter', 'tiktok', 'vm\\.tiktok'])
  assert.equal(valor(a, '--ffmpeg-location'), base.ffmpeg)
  assert.equal(valor(a, '--max-filesize'), '100M')
  assert.ok(Number(valor(a, '--socket-timeout')) > 0)
  assert.match(valor(a, '-S'), /res:720/)
  assert.equal(valor(a, '--merge-output-format'), 'mp4')
  assert.deepEqual(a.slice(-2), ['--', base.url])
  assert.equal(path.dirname(valor(a, '-o')), base.pasta)
  assert.ok(!a.includes('--impersonate'))
})

test('download só do trecho necessário: 0-10 por padrão, trecho pedido, e até 60 s no !salvar', () => {
  assert.equal(valor(argsYtDlp(base), '--download-sections'), '*0-10')
  assert.equal(valor(argsYtDlp({ ...base, inicio: 2, fim: 6 }), '--download-sections'), '*2-6')
  assert.equal(valor(argsYtDlp({ ...base, inicio: 1.5, fim: 4 }), '--download-sections'), '*1.5-4')
  assert.equal(valor(argsYtDlp({ ...base, inicio: 5, fim: 40 }), '--download-sections'), '*5-15') // máximo 10 s
  assert.equal(valor(argsYtDlp({ ...base, inicio: 7 }), '--download-sections'), '*7-17')
  assert.equal(valor(argsYtDlp({ ...base, maxSeg: 60 }), '--download-sections'), '*0-60')
  assert.equal(valor(argsYtDlp({ ...base, inicio: 30, fim: 200, maxSeg: 60 }), '--download-sections'), '*30-90')
})

test('link que começa com "-" não vira opção, e % na pasta não vira modelo do yt-dlp', () => {
  const a = argsYtDlp({ ...base, url: '--exec=calc', pasta: path.join(os.tmpdir(), '100%') })
  assert.deepEqual(a.slice(-2), ['--', '--exec=calc'])
  assert.ok(valor(a, '-o').includes('100%%'))
})

test('impersonação só quando pedida (repetição do TikTok depois de 403)', () => {
  const a = argsYtDlp({ ...base, impersonar: true })
  assert.equal(valor(a, '--impersonate'), 'chrome')
  assert.ok(a.indexOf('--impersonate') < a.indexOf('--'))
})

test('erros do yt-dlp viram mensagens claras', () => {
  const casos = {
    'ERROR: No suitable extractor found for URL https://www.tiktok.com/?_r=1': 'link-invalido',
    'ERROR: [twitter] 1: NSFW tweet requires authentication. Use --cookies-from-browser or --cookies for the authentication.': 'privado',
    'ERROR: [TikTok] 7: You do not have permission to view this post. Log into an account that has access': 'privado',
    'ERROR: [TikTok] 7: Your IP address is blocked from accessing this post': 'bloqueado',
    'ERROR: [TikTok] 7: Unable to download webpage: HTTP Error 403: Forbidden': 'bloqueado',
    'ERROR: [twitter] 1: No video could be found in this tweet': 'sem-video',
    'ERROR: [twitter] 1: Twitter API says: This Post was deleted by the Post author': 'nao-encontrado',
    'ERROR: [twitter] 1: Requested tweet is unavailable': 'nao-encontrado',
    'ERROR: [TikTok] 7: Unable to download webpage: HTTP Error 404: Not Found': 'nao-encontrado',
    'ERROR: File is larger than max-filesize (200000000 bytes > 104857600 bytes). Aborting.': 'grande',
    'ERROR: [twitter] 1: Unable to download JSON metadata: <urlopen error [Errno 11001] getaddrinfo failed>': 'rede',
  }
  for (const [stderr, codigo] of Object.entries(casos)) {
    assert.equal(traduzirErroYtDlp(`WARNING: algo\n${stderr}\n`).codigo, codigo, stderr)
  }
  const outro = traduzirErroYtDlp('ERROR: [TikTok] 7: Algo estranho em C:\\Users\\Fulano\\AppData\\x')
  assert.equal(outro.codigo, 'download')
  assert.ok(!outro.message.includes('Fulano'), outro.message)
})

// ---------- nomes ----------
test('higienizador: nome digitável, sem acento, sem pasta, sem extensão perigosa', () => {
  assert.equal(higienizarNome('Gato Bravo'), 'gato-bravo')
  assert.equal(higienizarNome('Não acredito!!! 😂 #fyp #meme @fulano'), 'nao-acredito')
  assert.equal(higienizarNome('../../etc/passwd'), 'etc-passwd')
  assert.equal(higienizarNome('..\\..\\Windows\\win.ini'), 'windows-win-ini')
  assert.equal(higienizarNome('.oculto'), 'oculto')
  assert.equal(higienizarNome('CON'), 'con-meme')
  assert.equal(higienizarNome('nul'), 'nul-meme')
  for (const vazio of ['', '###', '😂😂', null, undefined, '---']) assert.equal(higienizarNome(vazio), 'video', String(vazio))
  const longo = higienizarNome('Um título muito comprido de um post qualquer que não acaba nunca mais')
  assert.ok(longo.length <= 40 && !longo.endsWith('-'), longo)
  for (const t of ['a/b', 'C:\\x', '..', 'x:y', ' . ', 'olá mundo', 'https://x.com/a e mais']) assert.ok(nomeSeguro(higienizarNome(t)), t)
})

test('nome a partir do título: tira o "Autor - " do X e o título vazio do TikTok', () => {
  assert.equal(nomeDoTitulo({ title: 'Historic Vids - One of the most intense moments', uploader: 'Historic Vids' }), 'one-of-the-most')
  assert.equal(nomeDoTitulo({ title: 'Quando o grave bate 😂 #fyp', uploader: 'x' }), 'quando-o-grave-bate')
  assert.equal(nomeDoTitulo({ title: 'Supercalifragilisticexpialidocious-extraordinario' }), 'supercalifragilisticexpialid')
  assert.equal(nomeDoTitulo({ title: 'TikTok video #7047596209028074758', uploader: 'fulano' }), 'video')
  assert.equal(nomeDoTitulo({}), 'video')
})

test('nome livre: nunca sobrescreve (em qualquer extensão, sem ligar pra maiúsculas)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figsom-teste-'))
  try {
    assert.equal(await nomeLivre(dir, 'gato'), 'gato')
    fs.writeFileSync(path.join(dir, 'Gato.MP4'), '')
    assert.equal(await nomeLivre(dir, 'gato'), 'gato-2')
    fs.writeFileSync(path.join(dir, 'gato-2.mp3'), '')
    assert.equal(await nomeLivre(dir, 'gato'), 'gato-3')
    assert.equal(await nomeLivre(path.join(dir, 'nao-existe'), 'gato'), 'gato')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// ---------- componente (yt-dlp) ----------
test('nome do executável oficial por sistema', () => {
  assert.equal(nomeDoExecutavel('win32', 'x64'), 'yt-dlp.exe')
  assert.equal(nomeDoExecutavel('linux', 'x64'), 'yt-dlp_linux')
  assert.equal(nomeDoExecutavel('linux', 'arm64'), 'yt-dlp_linux_aarch64')
  assert.equal(nomeDoExecutavel('freebsd', 'x64'), null)
})

test('lê o SHA2-256SUMS', () => {
  const somas = lerSomas(`${'a'.repeat(64)}  yt-dlp\n${'B'.repeat(64)}  yt-dlp.exe\r\nlixo\n${'c'.repeat(64)} *yt-dlp_linux\n`)
  assert.equal(somas.get('yt-dlp.exe'), 'b'.repeat(64))
  assert.equal(somas.get('yt-dlp_linux'), 'c'.repeat(64))
  assert.equal(somas.size, 3)
})

const sha = (b) => createHash('sha256').update(b).digest('hex')
let pasta
beforeEach(() => { pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'figsom-teste-')) })
afterEach(() => fs.rmSync(pasta, { recursive: true, force: true }))

// "GitHub" falso: latest → tag, SHA2-256SUMS e o binário dessa tag
function githubFalso({ versao = '2026.11.23', binario = Buffer.from('exe falso v1'), soma } = {}) {
  const chamadas = []
  const buscar = async (url) => {
    chamadas.push(url)
    if (url === `${REPO}/releases/latest`) return new Response(null, { status: 302, headers: { location: `${REPO}/releases/tag/${versao}` } })
    if (url === `${REPO}/releases/download/${versao}/SHA2-256SUMS`) return new Response(`${soma ?? sha(binario)}  yt-dlp.exe\n${'0'.repeat(64)}  yt-dlp_linux\n`)
    if (url === `${REPO}/releases/download/${versao}/yt-dlp.exe`) return new Response(binario, { headers: { 'content-length': String(binario.length) } })
    return new Response('não', { status: 404 })
  }
  return { buscar, chamadas }
}
const componente = (opcoes) => new ComponenteYtDlp({
  pasta, plataforma: 'win32', arquitetura: 'x64', testarImpersonacao: async () => true, ...opcoes,
})
const sobras = () => fs.readdirSync(pasta).filter((f) => f.endsWith('.baixando') || f.endsWith('.tmp'))

test('componente: baixa, confere o SHA-256 e instala (sem deixar temporários)', async () => {
  const gh = githubFalso()
  const r = await componente({ buscar: gh.buscar }).garantir()
  assert.equal(r.exe, path.join(pasta, 'yt-dlp.exe'))
  assert.equal(r.versao, '2026.11.23')
  assert.equal(r.impersonar, true)
  assert.equal(fs.readFileSync(r.exe, 'utf8'), 'exe falso v1')
  assert.deepEqual(sobras(), [])
})

test('componente: SHA-256 errado → descarta o arquivo e não instala nada', async () => {
  const gh = githubFalso({ soma: 'f'.repeat(64) })
  await assert.rejects(componente({ buscar: gh.buscar }).garantir(), { codigo: 'componente-sha' })
  assert.equal(fs.existsSync(path.join(pasta, 'yt-dlp.exe')), false)
  assert.deepEqual(sobras(), [])
})

test('componente: checa versão nova no máximo uma vez por semana', async () => {
  let agora = Date.parse('2026-11-25T12:00:00Z')
  const gh = githubFalso()
  const c = componente({ buscar: gh.buscar, agora: () => agora })
  await c.garantir()
  const depoisDeInstalar = gh.chamadas.length
  agora += 3 * 24 * 3600 * 1000
  await c.garantir()
  assert.equal(gh.chamadas.length, depoisDeInstalar) // 3 dias depois: nem consulta
  agora += 5 * 24 * 3600 * 1000
  await c.garantir()
  assert.ok(gh.chamadas.length > depoisDeInstalar) // 8 dias depois: consulta
  assert.ok(!gh.chamadas.slice(depoisDeInstalar).some((u) => u.endsWith('/yt-dlp.exe'))) // mesma soma: não baixa de novo
})

test('componente: atualização com SHA-256 errado mantém a versão antiga inteira', async () => {
  let agora = Date.parse('2026-11-25T12:00:00Z')
  const c = componente({ buscar: githubFalso().buscar, agora: () => agora })
  await c.garantir()
  agora += 8 * 24 * 3600 * 1000
  const logs = []
  c.buscar = githubFalso({ versao: '2026.12.01', binario: Buffer.from('exe NOVO'), soma: 'e'.repeat(64) }).buscar
  c.log = (t, n) => logs.push({ t, n })
  const r = await c.garantir()
  assert.equal(r.versao, '2026.11.23')
  assert.equal(fs.readFileSync(r.exe, 'utf8'), 'exe falso v1')
  assert.ok(logs.some((l) => l.n === 'aviso'))
  assert.deepEqual(sobras(), [])
})

test('componente: atualização boa troca o arquivo', async () => {
  let agora = Date.parse('2026-11-25T12:00:00Z')
  const c = componente({ buscar: githubFalso().buscar, agora: () => agora })
  await c.garantir()
  agora += 8 * 24 * 3600 * 1000
  c.buscar = githubFalso({ versao: '2026.12.01', binario: Buffer.from('exe NOVO') }).buscar
  const r = await c.garantir()
  assert.equal(r.versao, '2026.12.01')
  assert.equal(fs.readFileSync(r.exe, 'utf8'), 'exe NOVO')
})

test('componente: arquivo mexido (soma não bate) é baixado de novo', async () => {
  const gh = githubFalso()
  const c = componente({ buscar: gh.buscar })
  await c.garantir()
  fs.writeFileSync(path.join(pasta, 'yt-dlp.exe'), 'mexeram aqui')
  assert.equal((await c.situacao()).instalado, false)
  await c.garantir()
  assert.equal(fs.readFileSync(path.join(pasta, 'yt-dlp.exe'), 'utf8'), 'exe falso v1')
})

test('componente: sem internet usa o que já tem; sem nada instalado, erro claro', async () => {
  let agora = Date.parse('2026-11-25T12:00:00Z')
  const c = componente({ buscar: githubFalso().buscar, agora: () => agora })
  await c.garantir()
  agora += 30 * 24 * 3600 * 1000
  c.buscar = async () => { throw new TypeError('fetch failed') }
  assert.equal((await c.garantir()).versao, '2026.11.23')
  const novo = componente({ buscar: c.buscar })
  fs.rmSync(path.join(pasta, 'yt-dlp.exe'))
  await assert.rejects(novo.garantir(), { codigo: 'componente-rede' })
})

test('componente: chamadas ao mesmo tempo baixam uma vez só', async () => {
  const gh = githubFalso()
  const c = componente({ buscar: gh.buscar })
  await Promise.all([c.garantir(), c.garantir(), c.garantir()])
  assert.equal(gh.chamadas.filter((u) => u.endsWith('/yt-dlp.exe')).length, 1)
})

test('componente: versão com formato estranho no redirecionamento é recusada', async () => {
  const buscar = async () => new Response(null, { status: 302, headers: { location: `${REPO}/releases/tag/..%2F..%2Fgolpe` } })
  await assert.rejects(componente({ buscar }).garantir(), { codigo: 'componente-rede' })
})
