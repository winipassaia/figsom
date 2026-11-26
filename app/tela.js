// tela.js — interface do figsom (roda na janela, sem acesso ao Node)
const $ = (s) => document.querySelector(s)
const api = window.figsom

const TEXTO_STATUS = {
  parado: 'Desconectado',
  iniciando: 'Conectando…',
  'aguardando-qr': 'Esperando o QR',
  conectado: 'Conectado',
  reconectando: 'Reconectando…',
  pausado: 'Pausado',
  deslogado: 'Desconectado',
}

let ultimoStatus = null
let ultimoEstado = null

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v)
    else e.setAttribute(k, v)
  }
  for (const f of filhos.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(f))
  return e
}

const adesivoSom = (classe) =>
  el('div', { class: `adesivo adesivo-som ${classe}` }, el('div', { class: 'miolo' }, el('span', { class: 'barra' }), el('span', { class: 'barra' }), el('span', { class: 'barra' }), el('span', { class: 'barra' })))

function renderPalco(e) {
  const palco = $('#palco-conteudo')
  palco.replaceChildren()

  if (e.status === 'aguardando-qr' && e.qr) {
    palco.append(
      el('div', { class: 'adesivo adesivo-qr' }, el('img', { src: e.qr, alt: 'QR code para conectar o WhatsApp' })),
      el('h1', {}, 'Escaneie com o seu WhatsApp'),
      el('p', { class: 'instrucao' },
        'No celular: ', el('b', {}, '⋮ Mais opções'), ' → ', el('b', {}, 'Aparelhos conectados'), ' → ', el('b', {}, 'Conectar um aparelho'), '. Depois aponte a câmera pro código.'),
    )
  } else if (e.status === 'conectado') {
    const nome = e.conta?.nome ? `, ${e.conta.nome.split(' ')[0]}` : ''
    const adesivo = adesivoSom('')
    if (ultimoStatus && ultimoStatus !== 'conectado') adesivo.classList.add('colou')
    palco.append(
      adesivo,
      el('h1', {}, `Tudo pronto${nome}!`),
      el('p', { class: 'instrucao' },
        'Mande um vídeo (ou um link do X/TikTok) na conversa com você mesmo e responda com ', el('code', {}, '!criar'),
        '. A figurinha com som chega em alguns segundos. Seus memes também dá pra mandar daqui, pela aba ', el('b', {}, 'Memes'), '.'),
    )
  } else if (e.status === 'iniciando' || e.status === 'reconectando') {
    palco.append(
      adesivoSom('calmo ouvindo'),
      el('h1', {}, e.status === 'iniciando' ? 'Conectando ao WhatsApp…' : 'Reconectando…'),
      el('p', {}, 'Isso leva só alguns segundos.'),
    )
  } else if (e.status === 'pausado') {
    palco.append(
      adesivoSom('calmo'),
      el('h1', {}, 'Pausado'),
      el('p', { class: 'instrucao' },
        'O figsom não está atendendo os comandos agora. Sua conta ', el('b', {}, 'continua conectada'),
        ': pra voltar, é só retomar, sem QR. Um ', el('code', {}, '!criar'), ' mandado enquanto está pausado é atendido quando você retomar.'),
      el('button', { class: 'btn btn-primario', onclick: () => api.conectar() }, 'Retomar'),
    )
  } else {
    palco.append(
      adesivoSom('calmo'),
      el('h1', {}, 'Desconectado'),
      el('p', {}, 'Conecte sua conta do WhatsApp pra começar a criar figurinhas com som.'),
      el('button', { class: 'btn btn-primario', onclick: () => api.conectar() }, 'Conectar WhatsApp'),
    )
  }
}

function renderEstado(e) {
  ultimoEstado = e
  const pill = $('#status')
  pill.dataset.status = e.status
  $('#status-texto').textContent = TEXTO_STATUS[e.status] || e.status // sem número de telefone: a tela pode aparecer em vídeos
  $('#chk-apagar').checked = !!e.config?.apagarPedido
  // Pausar: só faz sentido com a conta já vinculada. Desconectar fica escondido quando pausado
  // (sem conexão não dá pra avisar o WhatsApp; a tela de pausado explica: retomar e depois desconectar).
  $('#btn-pausar').hidden = !['conectado', 'reconectando'].includes(e.status)
  $('#btn-desconectar').hidden = !['conectado', 'aguardando-qr', 'reconectando'].includes(e.status)
  $('#versao').textContent = e.versao ? `v${e.versao}` : ''
  renderPalco(e)
  renderBaixador(e)
  atualizarBotoes()
  ultimoStatus = e.status
}

// ---------- abas ----------
let abaAtual = 'inicio'
function mostrarAba(nome) {
  abaAtual = nome
  for (const b of document.querySelectorAll('.aba')) {
    const ativa = b.dataset.aba === nome
    b.setAttribute('aria-selected', String(ativa))
    b.tabIndex = ativa ? 0 : -1
    document.getElementById(`painel-${b.dataset.aba}`).hidden = !ativa
  }
  if (nome === 'memes' && !bibliotecaCarregada) carregarBiblioteca()
}
document.querySelectorAll('.aba').forEach((b) => b.addEventListener('click', () => mostrarAba(b.dataset.aba)))
$('.abas').addEventListener('keydown', (ev) => {
  if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return
  const abas = [...document.querySelectorAll('.aba')]
  const i = abas.findIndex((a) => a.dataset.aba === abaAtual)
  const prox = abas[(i + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length]
  mostrarAba(prox.dataset.aba)
  prox.focus()
})

// ---------- aba Memes: baixar vídeo ----------
let baixando = false
let enviando = false

function mostrarResultado(seletor, texto, tipo = '') {
  const r = $(seletor)
  r.textContent = texto
  r.dataset.tipo = tipo
}

// aviso flutuante da Biblioteca; com ms, some sozinho (e volta a dica, se estiver desconectado)
let timerAviso = null
function avisar(texto, tipo = '', ms = 0) {
  clearTimeout(timerAviso)
  mostrarResultado('#enviar-resultado', texto, tipo)
  if (ms) timerAviso = setTimeout(() => { mostrarResultado('#enviar-resultado', ''); atualizarBotoes() }, ms)
}

// Chave desligada: só a explicação. Ligada: o selo do yt-dlp (que enche durante o download) e o formulário.
function renderBaixador(e) {
  const ligado = !!e.config?.baixarLinks
  $('#chk-links').checked = ligado
  $('#baixador-desligado').hidden = ligado
  $('#baixador-ligado').hidden = !ligado
  if (!ligado) return
  const b = e.baixador || {}
  const ytdlp = 'yt‑dlp' // hífen que não quebra linha
  const pct = Math.round((b.progresso || 0) * 100)
  const textos = {
    baixando: `Baixando o ${ytdlp}… ${pct}%`,
    pronto: `Pronto · ${ytdlp} ${b.versao || ''}`.trim(),
    erro: `Não consegui baixar o ${ytdlp}. Confira a internet e ligue a chave de novo.`,
  }
  const estado = textos[b.estado] ? b.estado : 'preparando'
  const selo = $('#selo-baixador')
  selo.dataset.estado = estado
  selo.style.setProperty('--p', `${pct}%`)
  $('#baixador-status').textContent = textos[estado] || 'Preparando…'
}

function atualizarBotoes() {
  const e = ultimoEstado || {}
  const conectado = e.status === 'conectado'
  for (const b of document.querySelectorAll('#grade .btn-meme')) {
    b.disabled = !conectado || enviando
    b.title = conectado ? 'Cria a figurinha com as opções acima e manda pra conversa "Você"' : 'Conecte o WhatsApp pra enviar'
  }
  const r = $('#enviar-resultado')
  if (!conectado && !enviando && (!r.textContent || r.dataset.tipo === 'dica')) mostrarResultado('#enviar-resultado', 'Conecte o WhatsApp pra enviar daqui.', 'dica')
  if (conectado && r.dataset.tipo === 'dica') mostrarResultado('#enviar-resultado', '')
  $('#in-link').disabled = baixando
  $('#in-nome').disabled = baixando
  $('#btn-baixar').disabled = baixando || e.baixador?.estado === 'baixando'
}

$('#chk-links').addEventListener('change', async (ev) => renderEstado(await api.config({ baixarLinks: ev.target.checked })))

$('#form-baixar').addEventListener('submit', async (ev) => {
  ev.preventDefault()
  const url = $('#in-link').value.trim()
  if (!url) return mostrarResultado('#baixar-resultado', 'Cole o link do post.', 'erro')
  baixando = true
  $('#btn-baixar').textContent = 'Baixando…'
  mostrarResultado('#baixar-resultado', 'Baixando… o andamento aparece na Atividade.')
  atualizarBotoes()
  let r
  try {
    r = await api.baixarLink({ url, nome: $('#in-nome').value.trim() || null })
  } catch {
    r = { ok: false, erro: 'Não consegui baixar.' }
  }
  baixando = false
  $('#btn-baixar').textContent = 'Baixar'
  atualizarBotoes()
  if (r.ok) {
    $('#in-link').value = ''
    $('#in-nome').value = ''
    mostrarResultado('#baixar-resultado',
      `Salvo como "${r.nome}".${r.semAudio ? ' Ele não tem som: ponha na pasta um áudio com o mesmo nome.' : ''}`, r.semAudio ? 'aviso' : 'ok')
    carregarBiblioteca(r.nome)
  } else {
    mostrarResultado('#baixar-resultado', r.erro, 'erro')
  }
})

// ---------- aba Memes: biblioteca ----------
let bibliotecaCarregada = false

// miniaturas só de quem aparece na tela (o ffmpeg gera uma por vez, depois fica em cache)
const observador = new IntersectionObserver((entradas) => {
  for (const ent of entradas) {
    if (!ent.isIntersecting) continue
    observador.unobserve(ent.target)
    pedirMiniatura(ent.target)
  }
}, { root: $('#grade'), rootMargin: '160px' })

async function pedirMiniatura(li) {
  const url = await api.miniatura(li.dataset.nome).catch(() => null)
  if (!url) return
  const img = li.querySelector('img')
  img.src = url
  li.classList.add('com-mini')
}

// o adesivo "cola" (animação + ✓) e depois volta ao normal
function colar(li) {
  li.classList.remove('colou')
  void li.offsetWidth // recomeça a animação se já estava colado
  li.classList.add('colou')
  setTimeout(() => li.classList.remove('colou'), 2400)
}

async function carregarBiblioteca(novo) {
  bibliotecaCarregada = true
  let itens
  try {
    itens = await api.listarMemes()
  } catch {
    itens = []
  }
  renderGrade(itens, novo)
}

function renderGrade(itens, novo) {
  const grade = $('#grade')
  observador.disconnect()
  grade.replaceChildren()
  $('#memes-qtd').textContent = itens.length ? String(itens.length) : ''
  if (!itens.length) {
    grade.append(el('li', { class: 'grade-vazia' },
      adesivoSom('calmo'),
      el('span', {}, 'A pasta de memes está vazia. Baixe um vídeo aqui ao lado, ou coloque arquivos nela pelo Abrir pasta.')))
    return
  }
  for (const item of itens) {
    const acao = item.usavel
      ? el('button', { class: 'btn btn-mini btn-meme', type: 'button', onclick: (ev) => criarEnviar(item.nome, ev.currentTarget) }, 'Criar e enviar')
      : el('span', { class: 'meme-falta' }, item.tipo === 'audio' ? 'só áudio' : 'falta o áudio')
    const classes = ['meme', item.usavel ? '' : 'inutil', item.tipo === 'audio' ? 'so-audio' : ''].filter(Boolean).join(' ')
    const li = el('li', { class: classes },
      el('div', { class: 'meme-adesivo' },
        el('div', { class: 'meme-mini' }, el('img', { alt: '' })),
        el('div', { class: 'meme-onda', 'aria-hidden': 'true' }, el('span'), el('span'), el('span'), el('span'))),
      el('span', { class: 'meme-nome', title: item.nome }, item.nome),
      acao)
    li.dataset.nome = item.nome
    grade.append(li)
    if (item.tipo !== 'audio') observador.observe(li)
    if (item.nome === novo) {
      colar(li)
      li.scrollIntoView({ block: 'nearest' })
    }
  }
  atualizarBotoes()
}

// "1,5" → 1.5; vazio → null; inválido → undefined
function lerSegundos(v) {
  const t = String(v).trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 3600 ? n : undefined
}

async function criarEnviar(nome, botao) {
  const inicio = lerSegundos($('#in-ini').value)
  const fim = lerSegundos($('#in-fim').value)
  if (inicio === undefined || fim === undefined) return avisar('Trecho inválido: use segundos, como 2 e 6.', 'erro', 6000)
  if (fim != null && !(fim > (inicio ?? 0))) return avisar('Trecho inválido: o fim precisa vir depois do início.', 'erro', 6000)
  const li = botao.closest('.meme')
  enviando = true
  li.classList.add('enviando')
  botao.textContent = 'Criando…'
  avisar(`Criando "${nome}"…`)
  atualizarBotoes()
  let r
  try {
    r = await api.criarEnviar({ nome, modo: $('#chk-ajustar').checked ? 'ajustar' : 'cortar', inicio, fim })
  } catch {
    r = { ok: false, erro: 'Não consegui enviar.' }
  }
  enviando = false
  li.classList.remove('enviando')
  botao.textContent = 'Criar e enviar'
  if (r.ok) {
    colar(li)
    avisar(`"${nome}" enviada! Confira a conversa "Você" no celular.`, 'ok', 4500)
  } else {
    avisar(r.erro, 'erro', 9000)
  }
  atualizarBotoes()
}

$('#btn-atualizar').addEventListener('click', () => carregarBiblioteca())
$('#btn-abrir-pasta').addEventListener('click', () => api.abrirMemes())

// ---------- log ----------
const CLASSE_NIVEL = { ok: 'ok', aviso: 'aviso-log', erro: 'erro' }
function addLog({ nivel, texto, hora }) {
  const log = $('#log')
  log.querySelector('.vazio')?.remove()
  const h = new Date(hora)
  const hh = h.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const perto = log.scrollHeight - log.scrollTop - log.clientHeight < 40
  log.append(el('li', {}, el('time', {}, hh), el('span', { class: CLASSE_NIVEL[nivel] || '' }, texto)))
  while (log.children.length > 300) log.firstChild.remove()
  if (perto) log.scrollTop = log.scrollHeight
}

// ---------- ações ----------
$('#btn-aceitar').addEventListener('click', async () => {
  $('#aviso').hidden = true
  $('#app').hidden = false
  renderEstado(await api.aceitarAviso())
})
$('#btn-memes').addEventListener('click', () => api.abrirMemes())
$('#btn-pausar').addEventListener('click', () => api.pausar())
$('#chk-apagar').addEventListener('change', (ev) => api.config({ apagarPedido: ev.target.checked }))
document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => api.abrirLink(b.dataset.link)))

let confirmarTimer = null
$('#btn-desconectar').addEventListener('click', async (ev) => {
  const b = ev.currentTarget
  if (!b.classList.contains('confirmando')) {
    b.classList.add('confirmando')
    b.textContent = 'Clique de novo pra desconectar'
    confirmarTimer = setTimeout(() => { b.classList.remove('confirmando'); b.textContent = 'Desconectar conta' }, 4000)
    return
  }
  clearTimeout(confirmarTimer)
  b.classList.remove('confirmando')
  b.textContent = 'Desconectar conta'
  await api.desconectar()
})

// ---------- início ----------
;(async () => {
  const e = await api.estado()
  if (!e.config.aceitouAviso) {
    $('#aviso').hidden = false
  } else {
    $('#app').hidden = false
  }
  renderEstado(e)
  if (e.logs.length) e.logs.forEach(addLog)
  else $('#log').append(el('li', { class: 'vazio' }, 'Nada por aqui ainda. Quando você usar o !criar no WhatsApp, cada etapa aparece aqui.'))
  api.aoLog(addLog)
  api.aoEstado(renderEstado)
  api.aoMemes(() => { if (bibliotecaCarregada) carregarBiblioteca() })
})()
