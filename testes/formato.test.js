// Confere se o gancho no protobuf ainda gera o formato da figurinha com som
// com a versão do Baileys instalada. Se um update do Baileys quebrar o truque, falha aqui.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proto } from 'baileys'
import { instalarGanchoEncode, montarMensagem, conferirFormato, limparCaminhos } from '../src/enviar.js'
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
