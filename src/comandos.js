// comandos.js — entende o que foi digitado na conversa "Você" (função pura, sem WhatsApp).
//
//   !criar [ajustar] [2-6]            respondendo um vídeo
//   !criar <link> [ajustar] [2-6]     baixa do X/TikTok e cria
//   !criar <nome> [ajustar] [2-6]     usa um meme da pasta
//   !salvar <link> [nome] [5-20]      baixa pra pasta de memes
//   !memes                            lista os memes
//   !ajuda                            lista os comandos
//   !som = !criar e !som lista = !memes (atalhos da 1.0)

const COMANDO = /^!(criar|som|salvar|memes|ajuda)(?=\s|$)/i
const TRECHO = /^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/
const AJUSTAR = /^(ajustar|inteiro)$/i
// palavra que a pessoa pode escrever antes do link ("!criar tiktok https://...")
const SITE = /^(x|twitter|tiktok)$/i

// Parece link? Com http(s):// ou no formato "dominio.com/caminho" (sem o https://)
export function pareceLink(t) {
  return /^https?:\/\/\S+$/i.test(t) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*$/i.test(t)
}

const numero = (s) => parseFloat(s.replace(',', '.'))

export function interpretarComando(texto) {
  const t = String(texto ?? '').trim()
  const m = t.match(COMANDO)
  if (!m) return null
  const palavra = m[1].toLowerCase()
  const tokens = t.slice(m[0].length).trim().split(/\s+/).filter(Boolean)

  if (palavra === 'ajuda') return { comando: 'ajuda', palavra }
  if (palavra === 'memes') return { comando: 'memes', palavra }

  const opcoes = { modo: 'cortar' }
  const links = []
  const resto = []
  let trechoRuim = null
  for (const tok of tokens) {
    const faixa = tok.match(TRECHO)
    if (faixa) {
      opcoes.inicio = numero(faixa[1])
      opcoes.fim = numero(faixa[2])
      if (!(opcoes.fim > opcoes.inicio)) trechoRuim = tok
    } else if (AJUSTAR.test(tok)) opcoes.modo = 'ajustar'
    else if (pareceLink(tok)) links.push(tok)
    else resto.push(tok)
  }
  const exemplo = palavra === 'salvar' ? '!salvar <link> nome 5-20' : `!${palavra} 2-6`

  // !som lista (atalho antigo do !memes)
  if (palavra === 'som' && !links.length && resto.length === 1 && resto[0].toLowerCase() === 'lista') {
    return { comando: 'memes', palavra }
  }

  const comando = palavra === 'salvar' ? 'salvar' : 'criar'
  const erro = (mensagem) => ({ comando, palavra, erro: mensagem })
  if (trechoRuim) return erro(`Trecho inválido (${trechoRuim}): o fim precisa vir depois do início. Exemplo: ${exemplo}`)
  if (links.length > 1) return erro('Mande um link só por vez.')
  const link = links[0]
  const nomeTokens = link ? resto.filter((r) => !SITE.test(r)) : resto
  const nome = nomeTokens.join(' ') || undefined

  if (comando === 'salvar') {
    if (!link) return erro('Faltou o link do vídeo. Exemplo: !salvar https://x.com/... nome')
    const { modo, ...trecho } = opcoes // "ajustar" só vale na hora de criar a figurinha
    return { comando, palavra, link, nome, opcoes: trecho }
  }
  if (link && nome) {
    return erro(`Com link, o !${palavra} não usa nome. Pra guardar o vídeo com nome, use: !salvar <link> ${nome}`)
  }
  return { comando, palavra, ...(link ? { link } : {}), ...(nome ? { nome } : {}), opcoes }
}

// Resposta do !ajuda. Não pode começar com "!" (senão o figsom leria a própria resposta como comando).
export function textoAjuda({ links = false, dicaLinks = '' } = {}) {
  return [
    '🔊 *figsom*: comandos (só aqui, na conversa com você mesmo)',
    '',
    '*!criar* respondendo um vídeo: vira figurinha com som',
    '*!criar nome*: usa um meme da pasta',
    '*!criar link*: baixa do X ou do TikTok e cria',
    '*!salvar link nome*: guarda o vídeo na pasta de memes',
    '*!memes*: lista os memes da pasta',
    '*!ajuda*: esta lista',
    '',
    'Opções da figurinha: *ajustar* (vídeo inteiro, sem cortar) e um trecho em segundos, como *2-6*. Ex.: !criar 2-6 ajustar',
    links ? 'Links aceitos: X (Twitter) e TikTok.' : `Baixar de links está desligado. ${dicaLinks}`.trim(),
  ].join('\n')
}
