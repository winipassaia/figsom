// Confere se o gancho no protobuf ainda gera o formato da figurinha com som
// com a versão do Baileys instalada. Se um update do Baileys quebrar o truque, falha aqui.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proto } from 'baileys'
import { instalarGanchoEncode, montarMensagem, conferirFormato, limparCaminhos, comAssinatura, lerAssinatura, ASSINATURA } from '../src/enviar.js'
import { decodeRaw, extrairFigSom } from '../src/raw.js'

instalarGanchoEncode()
instalarGanchoEncode() // instalar de novo não pode duplicar o campo 134

const sticker = { url: 'https://x', mimetype: 'image/webp', mediaKey: Buffer.alloc(32, 1), isAnimated: true, width: 512, height: 512 }
const audio = { url: 'https://y', mimetype: 'audio/ogg; codecs=opus', seconds: 5, mediaKey: Buffer.alloc(32, 2) }

test('autoteste do formato passa', () => {
  assert.equal(conferirFormato(), null)
})

test('no topo: só messageContextInfo (35) e o campo novo (134), uma vez', () => {
  const bytes = Buffer.from(proto.Message.encode(montarMensagem(sticker, audio)).finish())
  const campos = decodeRaw(bytes).map((c) => c.num)
  assert.deepEqual(campos.sort((a, b) => a - b), [35, 134])
  const fig = extrairFigSom(bytes)
  assert.equal(fig.sticker.mimetype, 'image/webp')
  assert.equal(fig.audio.seconds, 5)
})

test('dentro do deviceSentMessage (seus outros aparelhos) o áudio continua lá', () => {
  const msg = montarMensagem(sticker, audio)
  const bytes = Buffer.from(proto.Message.encode({ deviceSentMessage: { destinationJid: '1@s.whatsapp.net', message: msg }, messageContextInfo: msg.messageContextInfo }).finish())
  assert.equal(extrairFigSom(bytes)?.audio?.mimetype, 'audio/ogg; codecs=opus')
})

test('o Baileys enxerga o sticker, mas ele não é propriedade própria', () => {
  const msg = montarMensagem(sticker, audio)
  assert.ok(msg.stickerMessage)
  assert.ok(!Object.keys(msg).includes('stickerMessage'))
})

test('limparCaminhos tira a pasta do usuário', () => {
  assert.equal(limparCaminhos('Error opening C:\\Users\\Fulano\\AppData\\Local\\Temp\\x.mp4'), 'Error opening ~\\AppData\\Local\\Temp\\x.mp4')
  assert.equal(limparCaminhos('falhou em /home/fulano/figsom/a.ogg'), 'falhou em ~/figsom/a.ogg')
})

// ---------- assinatura (nome do pacote e autor que o WhatsApp mostra ao tocar na figurinha) ----------
function bloco(tipo, dados) {
  const cab = Buffer.alloc(8)
  cab.write(tipo, 0, 'ascii')
  cab.writeUInt32LE(dados.length, 4)
  return Buffer.concat([cab, dados, dados.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)])
}
function webp(...blocos) {
  const corpo = Buffer.concat(blocos)
  const cab = Buffer.alloc(12)
  cab.write('RIFF', 0, 'ascii')
  cab.writeUInt32LE(corpo.length + 4, 4)
  cab.write('WEBP', 8, 'ascii')
  return Buffer.concat([cab, corpo])
}
const tipos = (buf) => {
  const t = []
  for (let p = 12; p + 8 <= buf.length;) { const n = buf.readUInt32LE(p + 4); t.push(buf.toString('ascii', p, p + 4)); p += 8 + n + (n & 1) }
  return t
}
// VP8X 512×512 animado, ANIM e um quadro (ANMF) com tamanho ímpar
const vp8x = Buffer.alloc(10); vp8x[0] = 0x12; vp8x.writeUIntLE(511, 4, 3); vp8x.writeUIntLE(511, 7, 3)
const animada = webp(bloco('VP8X', vp8x), bloco('ANIM', Buffer.alloc(6)), bloco('ANMF', Buffer.alloc(67, 7)))

test('assinatura: "Criado pelo APP figsom" em cima, "github @winipassaia" embaixo', () => {
  assert.equal(ASSINATURA.pacote, 'Criado pelo APP figsom')
  assert.equal(ASSINATURA.autor, 'github @winipassaia')
  const a = comAssinatura(animada)
  assert.deepEqual(tipos(a), ['VP8X', 'ANIM', 'ANMF', 'EXIF'])
  assert.equal(a[20] & 0x08, 0x08) // VP8X marcando que tem EXIF
  assert.equal(a[20] & 0x12, 0x12) // continua animada, com transparência
  assert.equal(a.readUInt32LE(4), a.length - 8) // tamanho do RIFF certo
  assert.deepEqual(lerAssinatura(a), {
    'sticker-pack-id': 'io.github.winipassaia.figsom',
    'sticker-pack-name': 'Criado pelo APP figsom',
    'sticker-pack-publisher': 'github @winipassaia',
    emojis: [],
  })
  // o quadro de tamanho ímpar continua inteiro (com o byte de enchimento)
  assert.ok(a.subarray(12).includes(Buffer.alloc(67, 7)))
})

test('assinatura: aplicar de novo troca a anterior (não duplica)', () => {
  const duas = comAssinatura(comAssinatura(animada, { id: 'x', pacote: 'velho', autor: 'velho' }))
  assert.deepEqual(tipos(duas), ['VP8X', 'ANIM', 'ANMF', 'EXIF'])
  assert.equal(lerAssinatura(duas)['sticker-pack-name'], 'Criado pelo APP figsom')
})

test('assinatura: WebP simples (sem VP8X) ganha o VP8X com o tamanho certo', () => {
  // VP8L 300×200 com transparência: assinatura 0x2f + largura-1 (14 bits) + altura-1 (14 bits) + alfa
  const vp8l = Buffer.alloc(64); vp8l[0] = 0x2f; vp8l.writeUInt32LE((299) | (199 << 14) | (1 << 28), 1)
  const a = comAssinatura(webp(bloco('VP8L', vp8l)))
  assert.deepEqual(tipos(a), ['VP8X', 'VP8L', 'EXIF'])
  assert.equal(a.readUIntLE(24, 3) + 1, 300)
  assert.equal(a.readUIntLE(27, 3) + 1, 200)
  assert.equal(a[20], 0x10 | 0x08) // alfa + EXIF
})

test('assinatura: arquivo que não é WebP (ou cortado) passa sem mudar', () => {
  const lixo = Buffer.from('isso não é uma figurinha, só um texto qualquer comprido o bastante pra passar dos 64 bytes')
  assert.equal(comAssinatura(lixo), lixo)
  const cortada = animada.subarray(0, animada.length - 10)
  assert.equal(comAssinatura(cortada), cortada)
})
