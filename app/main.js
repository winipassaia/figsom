// figsom (app com janela) — processo principal do Electron

import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { FigsomBot } from '../src/bot.js'
import { limparCaminhos } from '../src/enviar.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Só uma janela por vez: duas instâncias usariam a mesma sessão e uma derrubaria a outra.
// app.exit (e não app.quit) pra não chegar a criar janela nem conectar.
const primeiraInstancia = app.requestSingleInstanceLock()
if (!primeiraInstancia) app.exit(0)

// ---------- caminhos ----------
const DADOS = app.getPath('userData') // ex.: %APPDATA%/figsom
const AUTH_DIR = path.join(DADOS, 'auth')
const CONFIG_ARQ = path.join(DADOS, 'config.json')
const MEMES_DIR = path.join(app.getPath('documents'), 'figsom', 'memes')
const PAGINA = path.join(__dirname, 'index.html')

function caminhoFfmpeg() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  // App instalado: sempre o ffmpeg que vem junto (sem cair pro PATH, que no Windows procura
  // primeiro na pasta atual e poderia rodar um ffmpeg.exe qualquer).
  if (app.isPackaged) return path.join(process.resourcesPath, 'ffmpeg', exe)
  const dev = path.join(__dirname, '..', 'vendor', 'ffmpeg', exe)
  return fs.existsSync(dev) ? dev : 'ffmpeg' // desenvolvimento: vendor/ ou o do PATH
}

// Links externos: só páginas do GitHub, e sempre no navegador
function abrirLinkSeguro(url) {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' && u.hostname === 'github.com') shell.openExternal(u.href)
  } catch {}
}

// ---------- config ----------
const PADRAO = { aceitouAviso: false, apagarComando: true }
function lerConfig() {
  try { return { ...PADRAO, ...JSON.parse(fs.readFileSync(CONFIG_ARQ, 'utf8')) } } catch { return { ...PADRAO } }
}
function salvarConfig(c) {
  fs.mkdirSync(DADOS, { recursive: true })
  fs.writeFileSync(CONFIG_ARQ, JSON.stringify(c, null, 2))
}
let config = lerConfig()

// ---------- estado compartilhado com a janela ----------
const estado = { status: 'parado', qr: null, conta: null, logs: [] }
let janela = null
let bot = null

function enviar(canal, dado) {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dado)
}

function addLog(entrada) {
  estado.logs.push(entrada)
  if (estado.logs.length > 300) estado.logs.shift()
  enviar('log', entrada)
}

function criarBot() {
  bot = new FigsomBot({
    authDir: AUTH_DIR,
    memesDir: MEMES_DIR,
    ffmpeg: caminhoFfmpeg(),
    dicaFfmpeg: app.isPackaged
      ? 'O ffmpeg que vem com o figsom sumiu (às vezes o antivírus remove). Reinstale o figsom.'
      : 'Rode o app com o ffmpeg em vendor/ffmpeg ou no PATH.',
    apagarComando: config.apagarComando,
    soConversaComigo: true,
  })
  bot.on('log', addLog)
  bot.on('status', (s) => {
    estado.status = s
    if (s !== 'aguardando-qr') estado.qr = null
    if (s === 'deslogado' || s === 'parado') estado.conta = null
    enviar('estado', publico())
  })
  bot.on('qr', async (qr) => {
    estado.qr = await QRCode.toDataURL(qr, { margin: 1, width: 520, color: { dark: '#22193A', light: '#FFFFFF' } })
    enviar('estado', publico())
  })
  bot.on('conta', (c) => {
    estado.conta = c
    enviar('estado', publico())
  })
}

const publico = () => ({
  status: estado.status,
  qr: estado.qr,
  conta: estado.conta,
  config,
  memesDir: MEMES_DIR,
  versao: app.getVersion(),
})

async function iniciarBot() {
  if (!bot) criarBot()
  if (['iniciando', 'aguardando-qr', 'conectado', 'reconectando'].includes(bot.status)) return
  addLog({ nivel: 'info', texto: 'Iniciando conexão com o WhatsApp...', hora: new Date() })
  try {
    await bot.start()
  } catch (e) {
    addLog({ nivel: 'erro', texto: `Não consegui iniciar: ${limparCaminhos(e.message)}`, hora: new Date() })
  }
}

// ---------- IPC ----------
// Só a página do próprio app (app/index.html) pode chamar o processo principal
function remetenteOk(e) {
  try {
    const arq = fileURLToPath(e.senderFrame?.url || '')
    return process.platform === 'win32' ? arq.toLowerCase() === PAGINA.toLowerCase() : arq === PAGINA
  } catch {
    return false
  }
}
function tratar(canal, fn) {
  ipcMain.handle(canal, (e, ...args) => {
    if (!remetenteOk(e)) throw new Error(`chamada recusada (${canal})`)
    return fn(...args)
  })
}

tratar('estado', () => ({ ...publico(), logs: estado.logs, ...(process.env.FIGSOM_DEMO_AVISO ? { config: { ...config, aceitouAviso: false } } : {}) }))
tratar('aceitar-aviso', async () => {
  config = { ...config, aceitouAviso: true }
  salvarConfig(config)
  await iniciarBot()
  return publico()
})
tratar('conectar', () => iniciarBot())
// Pausar = desligar sem perder a sessão (igual a fechar o app ou o Ctrl+C do terminal)
tratar('pausar', async () => {
  await bot?.pausar()
})
tratar('desconectar', async () => {
  await bot?.logout()
  estado.conta = null
  enviar('estado', publico())
})
tratar('abrir-memes', async () => {
  fs.mkdirSync(MEMES_DIR, { recursive: true })
  await shell.openPath(MEMES_DIR)
})
// A janela só pode mudar opções conhecidas, com o tipo certo
tratar('config', (mudancas) => {
  if (typeof mudancas?.apagarComando === 'boolean') {
    config = { ...config, apagarComando: mudancas.apagarComando }
    salvarConfig(config)
    if (bot) bot.apagarComando = config.apagarComando
  }
  return publico()
})
tratar('abrir-link', (url) => abrirLinkSeguro(String(url)))

// ---------- janela ----------
function criarJanela() {
  janela = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: '#F1EEF8',
    title: 'figsom',
    icon: path.join(__dirname, 'icone.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  janela.once('ready-to-show', () => janela.show())
  janela.loadFile(PAGINA)
  // links externos abrem no navegador, nunca dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    abrirLinkSeguro(url)
    return { action: 'deny' }
  })
  janela.webContents.on('will-navigate', (e) => e.preventDefault())
}

app.on('second-instance', () => {
  if (janela) {
    if (janela.isMinimized()) janela.restore()
    janela.focus()
  }
})

app.whenReady().then(async () => {
  if (!primeiraInstancia) return
  Menu.setApplicationMenu(null)
  if (process.env.FIGSOM_DEMO && !process.env.FIGSOM_DEMO_AVISO) config = { ...config, aceitouAviso: true }
  criarJanela()
  if (process.env.FIGSOM_DEMO) {
    // modo de desenvolvimento: estados falsos + screenshots (não conecta)
    const { rodarDemo } = await import('./demo.js')
    return rodarDemo({ janela, estado, enviar, publico, addLog, QRCode, app })
  }
  if (app.isPackaged && !fs.existsSync(caminhoFfmpeg())) {
    addLog({ nivel: 'erro', texto: 'O ffmpeg que vem com o figsom não foi encontrado. Reinstale o figsom (às vezes o antivírus remove o arquivo).', hora: new Date() })
  }
  if (config.aceitouAviso) iniciarBot()
})

app.on('window-all-closed', async () => {
  await bot?.stop()
  app.quit()
})
