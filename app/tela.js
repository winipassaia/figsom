// tela.js — interface do figsom (roda na janela, sem acesso ao Node)
const $ = (s) => document.querySelector(s)
const api = window.figsom

const TEXTO_STATUS = {
  parado: 'Desconectado',
  iniciando: 'Conectando…',
  'aguardando-qr': 'Esperando o QR',
  conectado: 'Conectado',
  reconectando: 'Reconectando…',
  deslogado: 'Desconectado',
}

let ultimoStatus = null

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
      el('p', { class: 'instrucao' }, 'Mande um vídeo na conversa com você mesmo e responda ele com ', el('code', {}, '!som'), '. A figurinha com som chega em alguns segundos.'),
    )
  } else if (e.status === 'iniciando' || e.status === 'reconectando') {
    palco.append(
      adesivoSom('calmo ouvindo'),
      el('h1', {}, e.status === 'iniciando' ? 'Conectando ao WhatsApp…' : 'Reconectando…'),
      el('p', {}, 'Isso leva só alguns segundos.'),
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
  const pill = $('#status')
  pill.dataset.status = e.status
  $('#status-texto').textContent = TEXTO_STATUS[e.status] || e.status // sem número de telefone: a tela pode aparecer em vídeos
  $('#chk-apagar').checked = !!e.config?.apagarComando
  $('#btn-desconectar').hidden = !['conectado', 'aguardando-qr', 'reconectando'].includes(e.status)
  $('#versao').textContent = e.versao ? `v${e.versao}` : ''
  renderPalco(e)
  ultimoStatus = e.status
}

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
$('#chk-apagar').addEventListener('change', (ev) => api.config({ apagarComando: ev.target.checked }))
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
  else $('#log').append(el('li', { class: 'vazio' }, 'Nada por aqui ainda. Quando você usar o !som no WhatsApp, cada etapa aparece aqui.'))
  api.aoLog(addLog)
  api.aoEstado(renderEstado)
})()
