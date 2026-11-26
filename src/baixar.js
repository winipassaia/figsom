// baixar.js — baixa vídeos do X (Twitter) e do TikTok com o yt-dlp.
//
// O yt-dlp NÃO vem no instalador: ele é baixado sob demanda da release oficial
// (github.com/yt-dlp/yt-dlp), conferido contra o SHA2-256SUMS da mesma release
// e trocado de forma atômica (baixa num temporário, confere, renomeia).
// A checagem de versão nova acontece na hora do uso, no máximo uma vez por semana.

import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ErroFigsom, limparCaminhos } from './enviar.js'

export const REPO = 'https://github.com/yt-dlp/yt-dlp'
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000
const LIMITE_EXE = 100 * 1024 * 1024 // o yt-dlp.exe tem uns 25 MB
const TAG = /^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/ // ex.: 2026.11.23
const PRAZO_CHECAGEM_MS = 20_000
const PRAZO_DOWNLOAD_EXE_MS = 5 * 60_000

// ---------- links ----------
export const SITES = {
  'x.com': 'x', 'www.x.com': 'x', 'mobile.x.com': 'x',
  'twitter.com': 'x', 'www.twitter.com': 'x', 'mobile.twitter.com': 'x',
  'tiktok.com': 'tiktok', 'www.tiktok.com': 'tiktok', 'vm.tiktok.com': 'tiktok', 'vt.tiktok.com': 'tiktok',
}
export const NOME_SITE = { x: 'X', tiktok: 'TikTok' }
const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/
const SO_X_E_TIKTOK = 'Só dá pra baixar do X (Twitter) e do TikTok.'

// Confere se o link é de um site aceito e devolve { url, site } já normalizado
export function validarLink(texto) {
  let bruto = String(texto ?? '').trim()
  if (!bruto || bruto.length > 2048) throw new ErroFigsom('link', 'Mande o link do post do X ou do TikTok.')
  if (!/^[a-z][a-z0-9+.-]*:/i.test(bruto)) bruto = `https://${bruto}`
  let u
  try {
    u = new URL(bruto)
  } catch {
    throw new ErroFigsom('link', `Esse link não parece válido. ${SO_X_E_TIKTOK}`)
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ErroFigsom('link', `Esse link não parece válido. ${SO_X_E_TIKTOK}`)
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (YOUTUBE.test(host)) throw new ErroFigsom('link-youtube', `YouTube não é suportado. ${SO_X_E_TIKTOK}`)
  const site = SITES[host]
  if (!site) throw new ErroFigsom('link-site', `${SO_X_E_TIKTOK} Links de ${host} não são aceitos (YouTube também não).`)
  if (u.username || u.password || u.port) throw new ErroFigsom('link', `Esse link não parece válido. ${SO_X_E_TIKTOK}`)
  u.protocol = 'https:'
  if (host === 'tiktok.com') u.hostname = 'www.tiktok.com' // o yt-dlp só reconhece o endereço com www.
  else u.hostname = host
  u.search = '' // parâmetros de rastreio (?s=20, ?is_from_webapp=1...) não fazem falta
  u.hash = ''
  return { url: u.href, site }
}

// ---------- argumentos do yt-dlp ----------
// Nomes reais dos extractors (yt-dlp --list-extractors): o resto do yt-dlp fica desligado
export const EXTRACTORS = ['twitter', 'tiktok', 'vm\\.tiktok']

const seg = (n) => String(Math.round(n * 1000) / 1000)

export function argsYtDlp({ url, ffmpeg, pasta, inicio, fim, maxSeg = 10, impersonar = false }) {
  const ini = inicio > 0 ? inicio : 0
  const ate = Math.min(fim != null && fim > ini ? fim : ini + maxSeg, ini + maxSeg)
  return [
    '--ignore-config', '--no-plugin-dirs', '--no-js-runtimes', '--no-remote-components', '--no-cache-dir',
    '--no-playlist', '--playlist-items', '1',
    '--use-extractors', EXTRACTORS.join(','),
    '--ffmpeg-location', ffmpeg,
    // até 720p, de preferência mp4; se não tiver arquivo com imagem e som juntos, junta os dois
    '-f', 'b/bv*+ba/bv*', '-S', 'res:720,ext:mp4:m4a', '--merge-output-format', 'mp4',
    '--max-filesize', '100M', '--socket-timeout', '20', '--retries', '3',
    '--match-filters', '!is_live',
    '--download-sections', `*${seg(ini)}-${seg(ate)}`, // só o trecho necessário
    '--no-mtime', '--color', 'never',
    '--no-simulate', '--print', 'after_move:%(.{id,title,uploader,duration})j',
    ...(impersonar ? ['--impersonate', 'chrome'] : []),
    '-o', path.join(pasta.replaceAll('%', '%%'), 'video.%(ext)s'),
    '--', url,
  ]
}

// ---------- erros ----------
const ERROS = [
  [/No suitable extractor|Unsupported URL/i, 'link-invalido', 'Esse link não leva a um post com vídeo. No app do X ou do TikTok, use Compartilhar → Copiar link.'],
  [/NSFW|protected tweet|permission to view|requir\w* login|log ?in (for|to)|logged.?in|authenticat|--cookies|private|comfortable for some audiences|age.?restrict/i,
    'privado', 'Esse post é privado, tem restrição de idade ou só abre pra quem está logado. O figsom não entra na sua conta do X/TikTok, então não consegue baixar ele.'],
  [/IP address is blocked|HTTP Error 403|HTTP Error 429|Too Many Requests|rate.?limit|not available in your (country|region)|geo.?restrict/i,
    'bloqueado', 'O site bloqueou o download agora (acontece às vezes). Tente de novo daqui a alguns minutos.'],
  [/No video could be found|is not a video|No video formats found|Requested format is not available/i, 'sem-video', 'Esse post não tem vídeo (só foto ou texto).'],
  [/larger than max-filesize/i, 'grande', 'Esse vídeo é grande demais pra baixar (o limite é 100 MB).'],
  [/deleted|does(?:n't| not) exist|no longer exist|suspended|unavailable|not available|HTTP Error 40[14]|HTTP Error 410|status code \d+|Not Found/i,
    'nao-encontrado', 'Não achei esse post. Ele pode ter sido apagado, ou o link está incompleto.'],
  [/timed out|getaddrinfo|Failed to resolve|Name or service not known|Connection (?:refused|reset|aborted)|Temporary failure|Network is unreachable|No route to host|SSL|EOF occurred|urlopen error|Unable to download (?:webpage|JSON|API)/i,
    'rede', 'Não consegui falar com o site. Confira sua internet e tente de novo.'],
]

export function traduzirErroYtDlp(stderr) {
  const linhas = String(stderr ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const linha = linhas.filter((l) => /^ERROR:/i.test(l)).at(-1) || linhas.at(-1) || ''
  for (const [re, codigo, mensagem] of ERROS) if (re.test(linha)) return new ErroFigsom(codigo, mensagem)
  const motivo = limparCaminhos(linha.replace(/^ERROR:\s*/i, '').replace(/^\[[^\]]+\]\s*[\w-]*:\s*/, '')).slice(0, 200)
  return new ErroFigsom('download', `O download falhou: ${motivo || 'motivo desconhecido'}.`)
}

// ---------- processos ----------
const ativos = new Set()

function matarArvore(filho) {
  if (!filho.pid) return
  try {
    if (process.platform === 'win32') {
      // o yt-dlp.exe abre um processo filho (e o ffmpeg): /T derruba a árvore toda
      const taskkill = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')
      spawn(taskkill, ['/PID', String(filho.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {})
    } else {
      process.kill(-filho.pid, 'SIGKILL') // grupo inteiro (o filho foi criado com detached)
    }
  } catch {
    try { filho.kill('SIGKILL') } catch {}
  }
}

// Roda um executável sem shell, com prazo. Nunca rejeita por código de saída: devolve { code, stdout, stderr, estourou }
export function rodar(exe, args, { timeout = 120_000, limiteSaida = 1 << 20 } = {}) {
  return new Promise((resolve, reject) => {
    let filho
    try {
      filho = spawn(exe, args, {
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      })
    } catch (e) {
      return reject(e)
    }
    ativos.add(filho)
    let stdout = '', stderr = '', estourou = false
    filho.stdout.setEncoding('utf8').on('data', (d) => { if (stdout.length < limiteSaida) stdout += d })
    filho.stderr.setEncoding('utf8').on('data', (d) => { if (stderr.length < limiteSaida) stderr += d })
    const timer = setTimeout(() => { estourou = true; matarArvore(filho) }, timeout)
    filho.on('error', (e) => { clearTimeout(timer); ativos.delete(filho); reject(e) })
    filho.on('close', (code) => { clearTimeout(timer); ativos.delete(filho); resolve({ code, stdout, stderr, estourou }) })
  })
}

// Pra fechar o app sem deixar download rodando sozinho
export function cancelarDownloads() {
  for (const filho of ativos) matarArvore(filho)
}

// "ffmpeg" sem caminho → procura no PATH (só pastas absolutas, nunca a pasta atual)
export function acharNoPath(nome) {
  if (path.isAbsolute(nome) || /[\\/]/.test(nome)) return existsSync(nome) ? nome : null
  const ext = process.platform === 'win32' && !nome.toLowerCase().endsWith('.exe') ? '.exe' : ''
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir || !path.isAbsolute(dir)) continue
    const p = path.join(dir, nome + ext)
    if (existsSync(p)) return p
  }
  return null
}

// ---------- componente (o executável do yt-dlp) ----------
export function nomeDoExecutavel(plataforma = process.platform, arquitetura = process.arch) {
  if (plataforma === 'win32') return { x64: 'yt-dlp.exe', arm64: 'yt-dlp_arm64.exe', ia32: 'yt-dlp_x86.exe' }[arquitetura] ?? null
  if (plataforma === 'linux') return { x64: 'yt-dlp_linux', arm64: 'yt-dlp_linux_aarch64' }[arquitetura] ?? null
  if (plataforma === 'darwin') return 'yt-dlp_macos'
  return null
}

// SHA2-256SUMS: "<64 hex>  <arquivo>" por linha
export function lerSomas(texto) {
  const somas = new Map()
  for (const linha of String(texto).split(/\r?\n/)) {
    const m = linha.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/i)
    if (m) somas.set(m[2], m[1].toLowerCase())
  }
  return somas
}

export function sha256Arquivo(caminho) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(caminho).on('error', reject).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex')))
  })
}

// O exe oficial vem com curl_cffi? Aí dá pra tentar de novo "fingindo ser o Chrome" quando o TikTok dá 403
export async function impersonacaoDisponivel(exe) {
  const r = await rodar(exe, ['--ignore-config', '--no-plugin-dirs', '--list-impersonate-targets'], { timeout: 60_000 })
  return r.code === 0 && `${r.stdout}\n${r.stderr}`.split(/\r?\n/).some((l) => /curl_cffi/i.test(l) && !/unavailable/i.test(l))
}

const erroRede = (e) =>
  e instanceof ErroFigsom ? e : new ErroFigsom('componente-rede', 'Não consegui baixar o yt-dlp do GitHub. Confira sua internet e tente de novo.')

export class ComponenteYtDlp {
  // buscar/agora/plataforma/testarImpersonacao existem pra testar sem internet
  constructor({
    pasta, log = () => {}, aoMudar = () => {}, buscar = (...a) => fetch(...a), agora = () => Date.now(),
    plataforma = process.platform, arquitetura = process.arch, testarImpersonacao = impersonacaoDisponivel,
  }) {
    Object.assign(this, { log, aoMudar, buscar, agora, testarImpersonacao })
    this.pasta = path.resolve(pasta) // "bin" do modo terminal vira caminho completo (o spawn não depende da pasta atual)
    this.arquivo = nomeDoExecutavel(plataforma, arquitetura)
    this.plataforma = plataforma
    this.emAndamento = null
  }

  get caminho() { return path.join(this.pasta, this.arquivo) }
  get arqEstado() { return path.join(this.pasta, 'yt-dlp.json') }

  async lerEstado() {
    try {
      return JSON.parse(await fs.readFile(this.arqEstado, 'utf8'))
    } catch {
      return null
    }
  }

  async salvarEstado(estado) {
    const tmp = `${this.arqEstado}.${randomBytes(4).toString('hex')}.tmp`
    await fs.writeFile(tmp, JSON.stringify(estado, null, 2))
    await fs.rename(tmp, this.arqEstado)
  }

  // Sem internet: o que já está instalado E bate com a soma guardada
  async situacao() {
    const estado = await this.lerEstado()
    if (!this.arquivo || !estado || estado.arquivo !== this.arquivo) return { instalado: false, estado }
    const sha = await sha256Arquivo(this.caminho).catch(() => null)
    return sha === estado.sha256 ? { instalado: true, estado } : { instalado: false, estado }
  }

  // Devolve { exe, versao, impersonar }, instalando ou atualizando se precisar. Chamadas juntas esperam a mesma.
  garantir() {
    this.emAndamento ??= this.#garantir().finally(() => { this.emAndamento = null })
    return this.emAndamento
  }

  #pronto(estado) {
    this.aoMudar({ estado: 'pronto', versao: estado.versao })
    return { exe: this.caminho, versao: estado.versao, impersonar: !!estado.impersonar }
  }

  async #garantir() {
    if (!this.arquivo) throw new ErroFigsom('componente-sistema', 'Não tem yt-dlp pronto pra este sistema, então baixar de links não funciona aqui.')
    const { instalado, estado } = await this.situacao()
    if (instalado && this.agora() - Date.parse(estado.checadoEm) < SEMANA_MS) return this.#pronto(estado)
    let ultima
    try {
      ultima = await this.ultimaVersao()
    } catch (e) {
      if (instalado) {
        this.log('Não consegui ver se o yt-dlp tem versão nova (sem internet?). Usando a que já está aqui.', 'aviso')
        return this.#pronto(estado)
      }
      this.aoMudar({ estado: 'erro' })
      throw erroRede(e)
    }
    if (instalado && ultima.sha256 === estado.sha256) {
      await this.salvarEstado({ ...estado, checadoEm: new Date(this.agora()).toISOString() })
      return this.#pronto(estado)
    }
    try {
      return await this.instalar(ultima, instalado)
    } catch (e) {
      if (instalado) {
        this.log(`Não consegui atualizar o yt-dlp: ${e.message} Usando a versão que já está aqui.`, 'aviso')
        return this.#pronto(estado)
      }
      this.aoMudar({ estado: 'erro' })
      throw erroRede(e)
    }
  }

  // Versão mais nova: o "latest" redireciona pra /releases/tag/<versão>. A soma e o exe vêm DESSA versão.
  async ultimaVersao() {
    const prazo = () => AbortSignal.timeout(PRAZO_CHECAGEM_MS)
    const r = await this.buscar(`${REPO}/releases/latest`, { redirect: 'manual', signal: prazo() })
    const versao = (r.headers.get('location') || '').match(/\/releases\/tag\/([^/?#]+)\/?$/)?.[1]
    if (!versao || !TAG.test(versao)) throw new ErroFigsom('componente-rede', 'Não consegui descobrir a versão mais nova do yt-dlp.')
    const s = await this.buscar(`${REPO}/releases/download/${versao}/SHA2-256SUMS`, { signal: prazo() })
    if (!s.ok) throw new ErroFigsom('componente-rede', `O GitHub respondeu ${s.status} ao buscar as somas do yt-dlp.`)
    const sha256 = lerSomas(await s.text()).get(this.arquivo)
    if (!sha256) throw new ErroFigsom('componente-rede', `A release ${versao} do yt-dlp não tem soma pro ${this.arquivo}.`)
    return { versao, sha256, url: `${REPO}/releases/download/${versao}/${this.arquivo}` }
  }

  async instalar({ versao, sha256, url }, atualizando = false) {
    await fs.mkdir(this.pasta, { recursive: true })
    const tmp = path.join(this.pasta, `.${this.arquivo}.${randomBytes(6).toString('hex')}.baixando`)
    this.log(atualizando
      ? `🔄 Atualizando o componente de download (yt-dlp ${versao})...`
      : `⬇️  Baixando o componente de download (yt-dlp ${versao}) da página oficial...`)
    this.aoMudar({ estado: 'baixando', progresso: 0, versao })
    try {
      const r = await this.buscar(url, { signal: AbortSignal.timeout(PRAZO_DOWNLOAD_EXE_MS) })
      if (!r.ok || !r.body) throw new ErroFigsom('componente-rede', `O GitHub respondeu ${r.status} ao baixar o yt-dlp.`)
      const total = Number(r.headers.get('content-length')) || 0
      if (total > LIMITE_EXE) throw new ErroFigsom('componente-tamanho', 'O arquivo do yt-dlp veio grande demais. Descartei.')
      const hash = createHash('sha256')
      const arq = await fs.open(tmp, 'wx', 0o700)
      let baixado = 0, ultimoQuarto = 0, ultimoAviso = 0
      try {
        for await (const parte of r.body) {
          baixado += parte.length
          if (baixado > LIMITE_EXE) throw new ErroFigsom('componente-tamanho', 'O arquivo do yt-dlp veio grande demais. Descartei.')
          hash.update(parte)
          await arq.write(parte)
          if (total) {
            const p = baixado / total
            if (p - ultimoAviso >= 0.02) { ultimoAviso = p; this.aoMudar({ estado: 'baixando', progresso: p, versao }) }
            const quarto = Math.floor(p * 4)
            if (quarto > ultimoQuarto && quarto < 4) { ultimoQuarto = quarto; this.log(`   ${quarto * 25}% (${(total / 1048576).toFixed(0)} MB)`) }
          }
        }
      } finally {
        await arq.close()
      }
      if (hash.digest('hex') !== sha256) {
        throw new ErroFigsom('componente-sha', 'O yt-dlp baixado não bate com a soma SHA-256 da página oficial. Por segurança, descartei o arquivo.')
      }
      if (this.plataforma !== 'win32') await fs.chmod(tmp, 0o755)
      await fs.rename(tmp, this.caminho) // troca atômica: ou fica o antigo inteiro, ou o novo inteiro
    } catch (e) {
      await fs.rm(tmp, { force: true }).catch(() => {})
      throw e
    }
    let impersonar = false
    try { impersonar = await this.testarImpersonacao(this.caminho) } catch {}
    const estado = { arquivo: this.arquivo, versao, sha256, checadoEm: new Date(this.agora()).toISOString(), impersonar }
    await this.salvarEstado(estado)
    this.log(`✅ Componente de download pronto (yt-dlp ${versao}).`, 'ok')
    return this.#pronto(estado)
  }
}

// ---------- download do vídeo ----------
function lerInfo(stdout) {
  const linha = String(stdout).split(/\r?\n/).reverse().find((l) => l.trim().startsWith('{'))
  try {
    return linha ? JSON.parse(linha) : {}
  } catch {
    return {}
  }
}

async function acharBaixado(pasta) {
  const arquivos = await fs.readdir(pasta).catch(() => [])
  const video = arquivos.find((f) => /^video\.[a-z0-9]+$/i.test(f) && !/\.(part|ytdl|temp)$/i.test(f))
  return video ? path.join(pasta, video) : null
}

// Baixa o trecho num diretório próprio (que deve estar vazio) e devolve { arquivo, info }
export async function baixarComYtDlp({ exe, ffmpeg, url, site, pasta, inicio, fim, maxSeg = 10, impersonar = false, timeout = 150_000 }) {
  const tentar = async (comImpersonacao) => {
    await fs.rm(pasta, { recursive: true, force: true })
    await fs.mkdir(pasta, { recursive: true })
    try {
      return await rodar(exe, argsYtDlp({ url, ffmpeg, pasta, inicio, fim, maxSeg, impersonar: comImpersonacao }), { timeout })
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EACCES') throw new ErroFigsom('componente-ausente', 'O yt-dlp não abriu (o antivírus pode ter removido). Desligue e ligue de novo "Baixar de links".')
      throw e
    }
  }
  let r = await tentar(false)
  // TikTok às vezes recusa (403) quem não parece navegador
  if (r.code !== 0 && !r.estourou && impersonar && site === 'tiktok' && /HTTP Error 403/i.test(r.stderr)) r = await tentar(true)
  if (r.estourou) throw new ErroFigsom('download-tempo', 'O download demorou demais e foi cancelado. Tente de novo daqui a pouco.')
  // trecho que começa depois do fim do vídeo: o ffmpeg do download sai com erro
  if (r.code !== 0 && inicio > 0 && /ffmpeg exited with code/i.test(r.stderr)) {
    throw new ErroFigsom('vazio', `Não sobrou nada no trecho ${inicio}-${fim ?? inicio + maxSeg}s. Ele passa do fim do vídeo?`)
  }
  if (r.code !== 0) throw traduzirErroYtDlp(r.stderr)
  const arquivo = await acharBaixado(pasta)
  if (!arquivo) throw new ErroFigsom('sem-video', 'O download terminou, mas não veio nenhum vídeo. O post é uma transmissão ao vivo ou só tem foto?')
  return { arquivo, info: lerInfo(r.stdout) }
}
