// Lógica do bot que não precisa de WhatsApp: reconexão, logout e nomes de meme.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FigsomBot } from '../src/bot.js'

let dir, bot, logs
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figsom-teste-'))
  bot = new FigsomBot({ authDir: path.join(dir, 'auth'), memesDir: path.join(dir, 'memes') })
  logs = []
  bot.on('log', (l) => logs.push(l))
  fs.mkdirSync(bot.authDir, { recursive: true })
  fs.writeFileSync(path.join(bot.authDir, 'creds.json'), '{}')
})
afterEach(() => {
  mock.timers.reset()
  fs.rmSync(dir, { recursive: true, force: true })
})

const queda = (statusCode) => ({ error: { output: { statusCode } } })
const socketFalso = ({ registrado = true, logout = async () => {} } = {}) => ({
  authState: { creds: { me: registrado ? { id: '5500000000000@s.whatsapp.net' } : undefined } },
  logout: mock.fn(logout),
  end: mock.fn(),
})

test('stop cancela a reconexão que estava agendada', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  bot.start = mock.fn(async () => {})
  await bot.aoFechar(queda(428), bot.geracao)
  assert.equal(bot.status, 'reconectando')
  await bot.stop()
  mock.timers.tick(60_000)
  assert.equal(bot.start.mock.callCount(), 0)
})

test('logout cancela a reconexão agendada (não volta a conectar sozinho)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  bot.start = mock.fn(async () => {})
  await bot.aoFechar(queda(408), bot.geracao)
  await bot.logout()
  mock.timers.tick(60_000)
  assert.equal(bot.start.mock.callCount(), 0)
})

test('sem 403/440: reconecta depois da espera', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  bot.start = mock.fn(async () => {})
  await bot.aoFechar(queda(428), bot.geracao)
  mock.timers.tick(2_000)
  assert.equal(bot.start.mock.callCount(), 1)
})

for (const codigo of [403, 440]) {
  test(`${codigo} não fica reconectando`, async () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    bot.start = mock.fn(async () => {})
    await bot.aoFechar(queda(codigo), bot.geracao)
    mock.timers.tick(60_000)
    assert.equal(bot.status, 'parado')
    assert.equal(bot.start.mock.callCount(), 0)
    assert.ok(logs.at(-1).nivel === 'erro')
  })
}

test('logout conectado: avisa o WhatsApp, apaga a sessão e encerra o socket', async () => {
  const sock = socketFalso()
  bot.sock = sock
  await bot.logout()
  assert.equal(sock.logout.mock.callCount(), 1)
  assert.equal(sock.end.mock.callCount(), 1)
  assert.equal(fs.existsSync(bot.authDir), false)
  assert.equal(bot.status, 'deslogado')
  assert.equal(logs.at(-1).nivel, 'ok')
})

test('logout sem internet: apaga a sessão mas avisa que pode ter ficado no celular', async () => {
  const sock = socketFalso({ logout: async () => { throw new Error('Connection Closed') } })
  bot.sock = sock
  await bot.logout()
  assert.equal(sock.end.mock.callCount(), 1)
  assert.equal(fs.existsSync(bot.authDir), false)
  assert.equal(logs.at(-1).nivel, 'aviso')
  assert.match(logs.at(-1).texto, /Aparelhos conectados/)
})

test('logout durante o QR (ainda não registrado) não tenta avisar o WhatsApp', async () => {
  const sock = socketFalso({ registrado: false })
  bot.sock = sock
  await bot.logout()
  assert.equal(sock.logout.mock.callCount(), 0)
  assert.equal(sock.end.mock.callCount(), 1)
  assert.equal(logs.at(-1).nivel, 'ok')
})

test('pausar desliga a conexão mas guarda a sessão (volta sem QR)', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  bot.start = mock.fn(async () => {})
  const sock = socketFalso()
  bot.sock = sock
  await bot.aoFechar(queda(428), bot.geracao) // tinha uma reconexão agendada
  bot.sock = sock
  await bot.pausar()
  mock.timers.tick(60_000)
  assert.equal(bot.status, 'pausado')
  assert.equal(sock.end.mock.callCount(), 1)
  assert.equal(sock.logout.mock.callCount(), 0) // não tira dos aparelhos conectados
  assert.equal(bot.start.mock.callCount(), 0) // não volta sozinho
  assert.ok(fs.existsSync(path.join(bot.authDir, 'creds.json'))) // sessão continua lá
})

test('desconectar estando pausado apaga a sessão e avisa pra remover no celular', async () => {
  fs.writeFileSync(path.join(bot.authDir, 'creds.json'), JSON.stringify({ me: { id: '5500000000000@s.whatsapp.net' } }))
  await bot.pausar()
  await bot.logout()
  assert.equal(fs.existsSync(bot.authDir), false)
  assert.equal(logs.at(-1).nivel, 'aviso')
  assert.match(logs.at(-1).texto, /Aparelhos conectados/)
})

test('nome de meme com pasta é recusado', async () => {
  for (const nome of ['../segredo', '..\\segredo', 'pasta/arquivo', 'C:\\video', '.oculto', '..']) {
    await assert.rejects(bot.carregarMeme(nome, {}), { codigo: 'nome' }, nome)
  }
})
