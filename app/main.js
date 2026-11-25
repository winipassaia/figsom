// figsom (app com janela) — processo principal do Electron

import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { FigsomBot } from '../src/bot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!app.requestSingleInstanceLock()) app.quit()

// ---------- caminhos ----------
const DADOS = app.getPath('userData') // ex.: %APPDATA%/figsom
const AUTH_DIR = path.join(DADOS, 'auth')
const CONFIG_ARQ = path.join(DADOS, 'config.json')
const MEMES_DIR = path.join(app.getPath('documents'), 'figsom', 'memes')

function caminhoFfmpeg() {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const candidatos = [
    app.isPackaged ? path.join(process.resourcesPath, 'ffmpeg', exe) : null,
    path.join(__dirname, '..', 'vendor', 'ffmpeg', exe), // dev
  ].filter(Boolean)
  return candidatos.find((p) => fs.existsSync(p)) || 'ffmpeg' // cai pro PATH
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
    addLog({ nivel: 'erro', texto: `Não consegui iniciar: ${e.message}`, hora: new Date() })
  }
}

// ---------- IPC ----------
ipcMain.handle('estado', () => ({ ...publico(), logs: estado.logs, ...(process.env.FIGSOM_DEMO_AVISO ? { config: { ...config, aceitouAviso: false } } : {}) }))
ipcMain.handle('aceitar-aviso', async () => {
  config = { ...config, aceitouAviso: true }
  salvarConfig(config)
  await iniciarBot()
  return publico()
})
ipcMain.handle('conectar', iniciarBot)
ipcMain.handle('desconectar', async () => {
  await bot?.logout()
  estado.conta = null
  enviar('estado', publico())
})
ipcMain.handle('abrir-memes', async () => {
  fs.mkdirSync(MEMES_DIR, { recursive: true })
  await shell.openPath(MEMES_DIR)
})
ipcMain.handle('config', (_e, mudancas) => {
  config = { ...config, ...mudancas }
  salvarConfig(config)
  if (bot && 'apagarComando' in mudancas) bot.apagarComando = !!mudancas.apagarComando
  return publico()
})
ipcMain.handle('abrir-link', (_e, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url)
})

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
  janela.loadFile(path.join(__dirname, 'index.html'))
  // links externos abrem no navegador, nunca dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
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
  Menu.setApplicationMenu(null)
  if (process.env.FIGSOM_DEMO && !process.env.FIGSOM_DEMO_AVISO) config = { ...config, aceitouAviso: true }
  criarJanela()
  if (process.env.FIGSOM_DEMO) {
    // modo de desenvolvimento: estados falsos + screenshots (não conecta)
    const { rodarDemo } = await import('./demo.js')
    return rodarDemo({ janela, estado, enviar, publico, addLog, QRCode, app })
  }
  if (config.aceitouAviso) iniciarBot()
})

app.on('window-all-closed', async () => {
  await bot?.stop()
  app.quit()
})
