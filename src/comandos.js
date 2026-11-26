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
// palavras que a pessoa escreve junto do link e que não são nome: "!criar tiktok https://...",
// "!criar link https://..." (copiando o "!criar <link>" da ajuda ao pé da letra)
const JUNTO_DO_LINK = /^(x|twitter|tiktok|link|<link>)$/i

// Parece link? Com http(s):// ou no formato "dominio.com/caminho" (sem o https://)
export function pareceLink(t) {
  return /^https?:\/\/\S+$/i.test(t) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*$/i.test(t)
}

// Primeiro link de um texto qualquer (ex.: a mensagem respondida com "!criar")
export function acharLink(texto) {
  return String(texto ?? '').split(/\s+/).map((t) => t.replace(/^[<(["']+|[>)\]"'.,;!?]+$/g, '')).find(pareceLink)
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
  const antes = [] // palavras antes do link (ou todas, se não tiver link)
  const depois = [] // palavras depois do link
  let trechoRuim = null
  for (const tok of tokens) {
    const faixa = tok.match(TRECHO)
    if (faixa) {
      opcoes.inicio = numero(faixa[1])
      opcoes.fim = numero(faixa[2])
      if (!(opcoes.fim > opcoes.inicio)) trechoRuim = tok
    } else if (AJUSTAR.test(tok)) opcoes.modo = 'ajustar'
    else if (pareceLink(tok)) links.push(tok)
    else (links.length ? depois : antes).push(tok)
  }
  const resto = [...antes, ...depois]
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

  if (comando === 'salvar') {
    if (!link) return erro('Faltou o link do vídeo. Exemplo: !salvar https://x.com/... gato')
    // "!salvar link <url> gato": só o que vem antes do link pode ser palavra solta; o nome é o resto
    const nome = [...antes.filter((r) => !JUNTO_DO_LINK.test(r)), ...depois].join(' ') || undefined
    const { modo, ...trecho } = opcoes // "ajustar" só vale na hora de criar a figurinha
    return { comando, palavra, link, nome, opcoes: trecho }
  }
  if (link) {
    // !criar com link não usa nome: palavras a mais não travam o comando, só são avisadas
    const sobra = resto.filter((r) => !JUNTO_DO_LINK.test(r)).join(' ')
    return { comando, palavra, link, opcoes, ...(sobra ? { ignorado: sobra } : {}) }
  }
  const nome = resto.join(' ') || undefined
  return { comando, palavra, ...(nome ? { nome } : {}), opcoes }
}

// Resposta do !ajuda. Não pode começar com "!" (senão o figsom leria a própria resposta como comando).
export function textoAjuda({ links = false, dicaLinks = '' } = {}) {
  return [
    '🔊 *figsom*: comandos (só aqui, na conversa com você mesmo)',
    '',
    '*!criar*: faz a figurinha com som. O vídeo pode vir de:',
    '• um vídeo ou uma mensagem com link que você responde com !criar',
    '• um link do X ou do TikTok: !criar <link> (cole o link no lugar de <link>)',
    '• um meme da pasta: !criar nome',
    '',
    '*!salvar <link> nome*: guarda o vídeo na pasta de memes',
    '*!memes*: lista os memes da pasta',
    '*!ajuda*: esta lista',
    '',
    'Opções do !criar: *ajustar* (vídeo inteiro, sem cortar) e um trecho em segundos, como *2-6*. Ex.: !criar 2-6 ajustar',
    links ? 'Links aceitos: X (Twitter) e TikTok.' : `Baixar de links está desligado. ${dicaLinks}`.trim(),
  ].join('\n')
}
