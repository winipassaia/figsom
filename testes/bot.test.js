// Lógica do bot que não precisa de WhatsApp: reconexão, logout e nomes de meme.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { FigsomBot } from '../src/bot.js'
import { ErroFigsom } from '../src/enviar.js'

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

// ---------- comandos e destino (sem WhatsApp de verdade) ----------
const EU_PN = '5500000000000@s.whatsapp.net'
const EU_LID = '123456789012345@lid'
const OUTRA = '5511888888888@s.whatsapp.net'
const sockConectado = () => ({
  user: { id: '5500000000000:7@s.whatsapp.net', lid: '123456789012345:7@lid', name: 'Ana' },
  authState: { creds: { me: { id: '5500000000000:7@s.whatsapp.net', lid: '123456789012345:7@lid' } } },
  sendMessage: mock.fn(async () => ({})),
})
let contador = 0
const msgTexto = (texto, remoteJid = EU_PN) => ({ key: { fromMe: true, id: `ID${++contador}`, remoteJid }, message: { conversation: texto } })
const respostas = (sock) => sock.sendMessage.mock.calls.map((c) => c.arguments[1].text).filter(Boolean)
const reacoes = (sock) => sock.sendMessage.mock.calls.filter((c) => c.arguments[1].react).map((c) => c.arguments[1].react.text)
const apagadas = (sock) => sock.sendMessage.mock.calls.filter((c) => c.arguments[1].delete)
// ordem das chamadas: 'R⏳', 'T' (texto), 'R✅'...
const ordem = (sock) => sock.sendMessage.mock.calls.map((c) => (c.arguments[1].react ? `R${c.arguments[1].react.text}` : c.arguments[1].text ? 'T' : 'D'))

test('destino do "Criar e enviar": o número da conta, sem o ":aparelho"', () => {
  assert.equal(bot.destinoProprio(sockConectado()), EU_PN)
})

test('destino do "Criar e enviar": o mesmo endereço (LID) em que os comandos chegam', async () => {
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('uma mensagem qualquer', '123456789012345:7@lid'))
  assert.equal(bot.destinoProprio(sock), EU_LID)
})

test('destino nunca é a conversa de outra pessoa, nem número/LID trocados de servidor', () => {
  const sock = sockConectado()
  bot.jidComigo = OUTRA
  assert.equal(bot.destinoProprio(sock), EU_PN)
  assert.equal(bot.ehConversaComigo(sock, '5500000000000@lid'), false)
  assert.equal(bot.ehConversaComigo(sock, '123456789012345@s.whatsapp.net'), false)
  assert.equal(bot.ehConversaComigo(sock, '5500000000000:3@s.whatsapp.net'), true)
})

test('comando em outra conversa é ignorado', async () => {
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!ajuda', OUTRA))
  assert.equal(sock.sendMessage.mock.callCount(), 0)
})

test('!ajuda responde na conversa (uma vez só) e não apaga o comando', async () => {
  const sock = sockConectado()
  const msg = msgTexto('!ajuda')
  await bot.tratarComando(sock, msg)
  await bot.tratarComando(sock, msg) // a mesma mensagem de novo (append + notify)
  assert.equal(respostas(sock).length, 1)
  assert.match(respostas(sock)[0], /!criar link/)
  assert.deepEqual(reacoes(sock), ['✅'])
  assert.equal(apagadas(sock).length, 0)
})

// ---------- reações no lugar de apagar ----------
const comMemeFalso = (b, { falha } = {}) => {
  b.carregarMeme = async () => {
    if (falha) throw new ErroFigsom('meme', falha)
    return { webp: Buffer.from('webp'), ogg: Buffer.from('ogg') }
  }
  b.enviarParaMim = mock.fn(async () => {})
}

test('por padrão o comando não é apagado (nem no bot, nem no modo terminal)', () => {
  assert.equal(new FigsomBot({ authDir: path.join(dir, 'x'), memesDir: path.join(dir, 'y') }).apagarPedido, false)
})

test('!criar que dá certo: reage ⏳ e depois ✅ na própria mensagem, sem apagar', async () => {
  comMemeFalso(bot)
  const sock = sockConectado()
  const msg = msgTexto('!criar gato 2-6')
  await bot.tratarComando(sock, msg)
  assert.deepEqual(ordem(sock), ['R⏳', 'R✅'])
  for (const c of sock.sendMessage.mock.calls) {
    assert.equal(c.arguments[0], EU_PN) // na conversa "Você"
    assert.deepEqual(c.arguments[1].react.key, msg.key) // na mensagem do comando
  }
  assert.equal(bot.enviarParaMim.mock.callCount(), 1)
})

test('!criar com LID: a reação vai pro mesmo endereço em que o comando chegou', async () => {
  comMemeFalso(bot)
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!criar gato', '123456789012345:7@lid'))
  assert.deepEqual(sock.sendMessage.mock.calls.map((c) => c.arguments[0]), ['123456789012345:7@lid', '123456789012345:7@lid'])
})

test('!criar que dá erro: ⏳ e depois ❌, com o motivo na Atividade', async () => {
  comMemeFalso(bot, { falha: 'Não achei "gato" na pasta de memes.' })
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!criar gato'))
  assert.deepEqual(ordem(sock), ['R⏳', 'R❌'])
  assert.ok(logs.some((l) => l.nivel === 'erro' && l.texto.includes('Não achei "gato"')))
  assert.equal(bot.enviarParaMim.mock.callCount(), 0)
})

test('com "apagar o comando" ligado, apaga em vez de reagir ✅', async () => {
  comMemeFalso(bot)
  bot.apagarPedido = true
  const sock = sockConectado()
  const msg = msgTexto('!criar gato')
  await bot.tratarComando(sock, msg)
  assert.deepEqual(ordem(sock), ['R⏳', 'D'])
  assert.deepEqual(apagadas(sock)[0].arguments[1].delete, msg.key)
})

test('com "apagar o comando" ligado, um erro não apaga: fica o ❌', async () => {
  comMemeFalso(bot, { falha: 'falhou' })
  bot.apagarPedido = true
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!criar gato'))
  assert.deepEqual(ordem(sock), ['R⏳', 'R❌'])
})

test('!memes e !som lista mostram só os arquivos de mídia da pasta', async () => {
  fs.mkdirSync(bot.memesDir, { recursive: true })
  for (const f of ['b.mp4', 'a.gif', 'a.mp3', 'anotacao.txt', '.oculto.mp4']) fs.writeFileSync(path.join(bot.memesDir, f), '')
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!memes'))
  await bot.tratarComando(sock, msgTexto('!som lista'))
  assert.equal(respostas(sock).length, 2)
  for (const r of respostas(sock)) {
    assert.match(r, /^🔊 memes:\na\nb\n/)
    assert.ok(!r.includes('anotacao') && !r.includes('oculto'))
  }
})

test('!criar <link> com a chave desligada responde explicando como ligar', async () => {
  const b = new FigsomBot({ authDir: path.join(dir, 'a2'), memesDir: path.join(dir, 'm2'), binDir: path.join(dir, 'bin'), dicaBaixador: 'Ligue a chave tal.' })
  b.componente.garantir = mock.fn()
  const sock = sockConectado()
  await b.tratarComando(sock, msgTexto('!criar https://x.com/a/status/1'))
  await b.tratarComando(sock, msgTexto('!salvar https://www.tiktok.com/@a/video/1 gato'))
  const [r1, r2] = respostas(sock)
  assert.match(r1, /^⚠️ Baixar de links \(X e TikTok\) está desligado\. Ligue a chave tal\./)
  assert.match(r2, /desligado/)
  assert.deepEqual(ordem(sock), ['R⏳', 'T', 'R❌', 'R⏳', 'T', 'R❌'])
  assert.equal(b.componente.garantir.mock.callCount(), 0)
})

test('link do YouTube (ou de outro site) é recusado com mensagem clara, sem baixar nada', async () => {
  bot.baixarLinks = true
  bot.componente.garantir = mock.fn()
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!criar https://youtu.be/abc'))
  await bot.tratarComando(sock, msgTexto('!salvar https://instagram.com/p/abc nome'))
  const [r1, r2] = respostas(sock)
  assert.match(r1, /YouTube não é suportado/)
  assert.match(r2, /Só dá pra baixar do X \(Twitter\) e do TikTok/)
  assert.equal(bot.componente.garantir.mock.callCount(), 0)
})

test('!salvar: nome higienizado, sem sobrescrever, e a resposta diz como usar', async () => {
  bot.baixarLinks = true
  // finge o yt-dlp: "baixa" um vídeo pra pasta temporária
  bot.baixarDoLink = async (_link, _opcoes, tmp) => {
    fs.mkdirSync(path.join(tmp, 'baixado'), { recursive: true })
    const arquivo = path.join(tmp, 'baixado', 'video.mp4')
    fs.writeFileSync(arquivo, 'video')
    return { arquivo, info: { title: 'Fulano - Gato pulando', uploader: 'Fulano' } }
  }
  let avisos = 0
  bot.on('memes', () => avisos++)
  const sock = sockConectado()
  await bot.tratarComando(sock, msgTexto('!salvar https://x.com/a/status/1 Gato Bravo!'))
  await bot.tratarComando(sock, msgTexto('!salvar https://x.com/a/status/1 gato bravo'))
  await bot.tratarComando(sock, msgTexto('!salvar https://x.com/a/status/1'))
  const arquivos = fs.readdirSync(bot.memesDir).sort()
  assert.deepEqual(arquivos, ['gato-bravo-2.mp4', 'gato-bravo.mp4', 'gato-pulando.mp4'])
  const [r1, r2, r3] = respostas(sock)
  assert.match(r1, /^✅ Salvei na pasta de memes como \*gato-bravo\*\.\n.*Pra virar figurinha: !criar gato-bravo/s)
  assert.match(r2, /já tinha um "gato-bravo"/)
  assert.match(r3, /\*gato-pulando\*/)
  assert.equal(avisos, 3)
  assert.deepEqual(reacoes(sock), ['⏳', '✅', '⏳', '✅', '⏳', '✅'])
  assert.equal(apagadas(sock).length, 0)
})

test('"Criar e enviar" pelo computador exige conexão', async () => {
  await assert.rejects(bot.enviarDoPC('gato', {}), { codigo: 'desconectado' })
})
