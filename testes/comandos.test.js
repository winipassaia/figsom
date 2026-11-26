// O que o figsom entende na conversa "Você" (sem WhatsApp).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { interpretarComando as ler, textoAjuda, pareceLink } from '../src/comandos.js'

const X = 'https://x.com/fulano/status/1790637656616943991'
const TT = 'https://www.tiktok.com/@fulano/video/7047596209028074758'

test('!criar sozinho (respondendo um vídeo) usa o padrão: cortar, sem trecho', () => {
  assert.deepEqual(ler('!criar'), { comando: 'criar', palavra: 'criar', opcoes: { modo: 'cortar' } })
})

test('opções em qualquer ordem, maiúsculas e vírgula decimal', () => {
  assert.deepEqual(ler('!CRIAR 2-6 ajustar').opcoes, { modo: 'ajustar', inicio: 2, fim: 6 })
  assert.deepEqual(ler('  !criar inteiro 1,5-4  ').opcoes, { modo: 'ajustar', inicio: 1.5, fim: 4 })
})

test('!criar nome (com espaços) usa um meme da pasta', () => {
  const c = ler('!criar gato bravo 3-7 inteiro')
  assert.equal(c.nome, 'gato bravo')
  assert.equal(c.link, undefined)
  assert.deepEqual(c.opcoes, { modo: 'ajustar', inicio: 3, fim: 7 })
})

test('!criar com link reconhece o link sozinho', () => {
  const c = ler(`!criar ${X} 2-6 ajustar`)
  assert.equal(c.comando, 'criar')
  assert.equal(c.link, X)
  assert.equal(c.nome, undefined)
  assert.deepEqual(c.opcoes, { modo: 'ajustar', inicio: 2, fim: 6 })
})

test('"x", "twitter" ou "tiktok" escrito antes do link é ignorado', () => {
  assert.equal(ler(`!criar x ${X}`).link, X)
  assert.equal(ler(`!criar x ${X}`).nome, undefined)
  assert.equal(ler(`!criar Twitter ${X}`).nome, undefined)
  assert.equal(ler(`!criar tiktok ${TT} 0-5`).link, TT)
  // sem link, "tiktok" é só o nome de um meme
  assert.equal(ler('!criar tiktok').nome, 'tiktok')
})

test('link sem https:// também é reconhecido', () => {
  assert.equal(ler('!criar vm.tiktok.com/ZMabc123/').link, 'vm.tiktok.com/ZMabc123/')
  assert.equal(pareceLink('x.com/a/status/1'), true)
  assert.equal(pareceLink('gato.mp4'), false)
  assert.equal(pareceLink('1,5-4'), false)
})

test('!criar com link e nome junto explica o !salvar; dois links é erro', () => {
  assert.match(ler(`!criar gato ${X}`).erro, /!salvar <link> gato/)
  assert.match(ler(`!criar ${X} ${TT}`).erro, /um link só/)
})

test('trecho invertido vira erro do comando', () => {
  assert.match(ler('!criar 6-2').erro, /Trecho inválido/)
  assert.match(ler('!criar 3-3').erro, /Trecho inválido/)
})

test('!som continua funcionando como atalho de !criar e !som lista de !memes', () => {
  assert.deepEqual(ler('!som'), { comando: 'criar', palavra: 'som', opcoes: { modo: 'cortar' } })
  assert.equal(ler('!som tome 3-7').nome, 'tome')
  assert.equal(ler(`!som ${X}`).link, X)
  assert.deepEqual(ler('!som lista'), { comando: 'memes', palavra: 'som' })
  assert.deepEqual(ler('!som LISTA'), { comando: 'memes', palavra: 'som' })
  // no !criar, "lista" é só um nome
  assert.equal(ler('!criar lista').nome, 'lista')
})

test('!salvar <link> [nome] [trecho]', () => {
  assert.deepEqual(ler(`!salvar ${X} gato bravo`), { comando: 'salvar', palavra: 'salvar', link: X, nome: 'gato bravo', opcoes: {} })
  assert.deepEqual(ler(`!salvar ${TT}`), { comando: 'salvar', palavra: 'salvar', link: TT, nome: undefined, opcoes: {} })
  assert.deepEqual(ler(`!salvar tiktok ${TT} dança 5-20`).opcoes, { inicio: 5, fim: 20 })
  assert.equal(ler(`!salvar tiktok ${TT} dança`).nome, 'dança')
  assert.match(ler('!salvar gato').erro, /Faltou o link/)
})

test('!memes e !ajuda', () => {
  assert.deepEqual(ler('!memes'), { comando: 'memes', palavra: 'memes' })
  assert.deepEqual(ler('!Memes qualquer coisa'), { comando: 'memes', palavra: 'memes' })
  assert.deepEqual(ler('!ajuda'), { comando: 'ajuda', palavra: 'ajuda' })
})

test('texto que não é comando é ignorado', () => {
  for (const t of ['oi', '', null, undefined, '!somar', '!criarx', '! criar', 'olha !criar', '!foto', '!salvarr']) {
    assert.equal(ler(t), null, String(t))
  }
})

test('a resposta do !ajuda não é lida como comando (o figsom recebe a própria resposta)', () => {
  assert.equal(ler(textoAjuda({ links: true })), null)
  assert.equal(ler(textoAjuda({ links: false, dicaLinks: 'Ligue a chave.' })), null)
  assert.match(textoAjuda({ links: false, dicaLinks: 'Ligue a chave.' }), /desligado\. Ligue a chave\./)
  assert.match(textoAjuda({ links: true }), /!salvar link nome/)
})
