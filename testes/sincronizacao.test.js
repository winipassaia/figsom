// Qual sincronização inicial o figsom aceita ao vincular (veja MODOS_SINCRONIZACAO em src/bot.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proto } from 'baileys'
import { politicaSincronizacao, FigsomBot } from '../src/bot.js'

const T = proto.HistorySync.HistorySyncType
const aceita = (modo, tipo) => politicaSincronizacao(modo)({ syncType: tipo })

test('mínima: só contatos e dados auxiliares, nenhuma conversa', () => {
  assert.equal(aceita('minima', T.PUSH_NAME), true)
  assert.equal(aceita('minima', T.NON_BLOCKING_DATA), true)
  for (const t of [T.INITIAL_BOOTSTRAP, T.RECENT, T.FULL, T.ON_DEMAND, T.INITIAL_STATUS_V3]) {
    assert.equal(aceita('minima', t), false, `tipo ${t}`)
  }
})

test('padrão: tudo menos o histórico completo', () => {
  for (const t of [T.INITIAL_BOOTSTRAP, T.RECENT, T.PUSH_NAME, T.NON_BLOCKING_DATA, T.ON_DEMAND]) {
    assert.equal(aceita('padrao', t), true, `tipo ${t}`)
  }
  assert.equal(aceita('padrao', T.FULL), false)
})

test('nenhuma: recusa tudo (comportamento da 1.1.0)', () => {
  for (const t of [T.INITIAL_BOOTSTRAP, T.RECENT, T.PUSH_NAME, T.NON_BLOCKING_DATA]) assert.equal(aceita('nenhuma', t), false)
})

test('o Baileys não considera a mínima como "tudo desligado" (some o aviso de sessão instável)', async () => {
  const { PROCESSABLE_HISTORY_TYPES } = await import('baileys/lib/Defaults/index.js')
  const pol = politicaSincronizacao('minima')
  const tudoDesligado = PROCESSABLE_HISTORY_TYPES.every((syncType) => pol({ syncType }) === false)
  assert.equal(tudoDesligado, false)
})

test('vínculo novo grava a marca e não avisa; vínculo antigo (sem marca) avisa pra conectar de novo', async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'figsom-teste-'))
  try {
    const bot = new FigsomBot({ authDir: dir })
    const logs = []
    bot.on('log', (l) => logs.push(l))
    // conexão vinda da 1.1.0: sem marca → avisa
    await bot.conferirVinculo()
    assert.equal(logs.length, 1)
    assert.equal(logs[0].nivel, 'aviso')
    assert.match(logs[0].texto, /Desconectar conta/)
    // vínculo novo (passou pelo QR) → grava a marca, sem aviso
    bot.pareando = true
    await bot.conferirVinculo()
    assert.equal(logs.length, 1)
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'figsom-vinculo.json'), 'utf8')).sincronizacao, 'minima')
    // próximas conexões com a marca → nada
    await bot.conferirVinculo()
    assert.equal(logs.length, 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('modo desconhecido cai na mínima', () => {
  assert.equal(new FigsomBot({ sincronizacao: 'qualquer' }).sincronizacao, 'minima')
  assert.equal(new FigsomBot({ sincronizacao: 'padrao' }).sincronizacao, 'padrao')
})
