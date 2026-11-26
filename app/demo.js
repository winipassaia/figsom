// demo.js — só pra desenvolvimento: simula estados e salva screenshots (não conecta no WhatsApp)
// Uso: FIGSOM_DEMO=1 FIGSOM_DEMO_SAIDA=<pasta> npx electron . --user-data-dir=<pasta>
//      (com FIGSOM_DEMO_AVISO=1, tira só o print do aviso inicial)
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const run = promisify(execFile)

// Memes de exemplo, gerados pelo próprio ffmpeg (sem arquivos de verdade de ninguém)
const EXEMPLOS = [
  ['tome', 'testsrc2=s=480x480:r=15'],
  ['gato-bravo', 'mandelbrot=s=480x480:r=15'],
  ['nao-acredito', 'life=s=480x480:r=15:mold=10:ratio=0.4:life_color=#FF4F86:death_color=#22193A'],
  ['risada', 'cellauto=s=480x480:r=15:rule=110'],
  ['plim', 'smptehdbars=s=480x480:r=15'],
  ['surpresa', 'gradients=s=480x480:r=15:c0=#FF4F86:c1=#17A673:speed=0.05'],
  ['parabens', 'rgbtestsrc=s=480x480:r=15'],
]
async function gerarExemplos(ffmpeg, memesDir) {
  fs.mkdirSync(memesDir, { recursive: true })
  for (const [nome, fonte] of EXEMPLOS) {
    const saida = path.join(memesDir, `${nome}.mp4`)
    if (fs.existsSync(saida)) continue
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', fonte, '-f', 'lavfi', '-i', 'sine=frequency=330',
      '-t', '3', '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'aac', '-shortest', saida], { windowsHide: true })
  }
  const soAudio = path.join(memesDir, 'so-o-som.m4a')
  if (!fs.existsSync(soAudio)) {
    await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=500', '-t', '2', '-c:a', 'aac', soAudio], { windowsHide: true })
  }
}

export async function rodarDemo({ janela, estado, enviar, publico, addLog, QRCode, app, memesDir, ffmpeg, mudarConfig }) {
  const saida = process.env.FIGSOM_DEMO_SAIDA || '/tmp'
  const tamanhoPadrao = janela.getSize()
  const foto = async (nome, ms = 900) => {
    await espera(ms)
    // com a janela coberta por outra, o Chromium pode não repintar: força antes de capturar
    janela.webContents.invalidate()
    await espera(250)
    const img = await janela.webContents.capturePage()
    fs.writeFileSync(`${saida}/${nome}.png`, img.toPNG())
  }
  const set = (s) => { Object.assign(estado, s); enviar('estado', publico()) }
  const js = (codigo) => janela.webContents.executeJavaScript(codigo)
  const aba = (nome) => js(`document.querySelector('[data-aba="${nome}"]').click()`)
  const log = (nivel, texto) => addLog({ nivel, texto, hora: new Date() })
  const pequena = () => janela.setSize(860, 620) // tamanho mínimo da janela
  const normal = () => janela.setSize(...tamanhoPadrao)

  await espera(1200)
  if (process.env.FIGSOM_DEMO_AVISO) {
    await foto('0-aviso')
    pequena()
    await foto('0-aviso-860')
    return app.quit()
  }
  await gerarExemplos(ffmpeg, memesDir).catch((e) => log('erro', `demo: não consegui gerar os exemplos (${e.message})`))

  if (process.env.FIGSOM_DEMO_LINK) return testarLink()

  set({ status: 'iniciando' })
  log('info', 'Iniciando conexão com o WhatsApp...')
  await foto('1-iniciando')

  const qr = await QRCode.toDataURL('2@demo-figsom-qr-code-de-exemplo-nao-escaneie,abcdefghijklmnopqrstuvwxyz0123456789', { margin: 1, width: 520, color: { dark: '#22193A', light: '#FFFFFF' } })
  set({ status: 'aguardando-qr', qr })
  await foto('2-qr')

  set({ status: 'conectado', qr: null, conta: { nome: 'Ana Souza', numero: '0000000000000' } })
  log('ok', 'Conectado como Ana Souza! Agora é só usar o "!criar" na conversa com você mesmo ("!ajuda" mostra todos os comandos).')
  log('info', '🎬 Pedido recebido: !criar (vídeo respondido)')
  log('info', '⬇️  Baixando o vídeo...')
  log('info', '⚙️  Convertendo vídeo em figurinha + áudio...')
  log('info', '⬆️  Enviando...')
  log('ok', '✅ Figurinha com som enviada! (354 KB, 6s) Toque nela e salve nas figurinhas.')
  log('erro', '✖ Responda um VÍDEO com "!criar" (segure o vídeo → Responder), ou use "!criar nome" ou "!criar <link>".')
  await foto('3-conectado')

  // aba Memes com o baixador ligado
  mudarConfig({ baixarLinks: true })
  set({ baixador: { estado: 'pronto', versao: '2026.11.23' } })
  log('info', '🎬 Pedido recebido: !criar (link do TikTok, 2-6s)')
  log('info', '⬇️  Baixando do TikTok...')
  log('info', '⚙️  Convertendo vídeo em figurinha + áudio...')
  log('info', '⬆️  Enviando...')
  log('ok', '✅ Figurinha com som enviada! (412 KB, 4s) Toque nela e salve nas figurinhas.')
  log('info', '🎬 Pedido do computador: baixar link do X')
  log('info', '⬇️  Baixando do X...')
  log('ok', '💾 Salvo na pasta de memes como "gato-bravo".')
  await aba('memes')
  await foto('4-memes', 3500) // tempo pras miniaturas
  // estados de um adesivo da grade: criando (barrinhas dançando) e enviado (cola e ganha o ✓)
  await js(`(() => {
    const t = document.querySelectorAll('#grade .meme')[2]
    t.classList.add('enviando'); t.querySelector('.btn-meme').textContent = 'Criando…'
    avisar('Criando "' + t.dataset.nome + '"…')
  })()`)
  await foto('4b-memes-criando', 500)
  await js(`(() => {
    const t = document.querySelectorAll('#grade .meme')[2]
    t.classList.remove('enviando'); t.querySelector('.btn-meme').textContent = 'Criar e enviar'
    colar(t)
    avisar('"' + t.dataset.nome + '" enviada! Confira a conversa "Você" no celular.', 'ok', 4500)
  })()`)
  await foto('4c-memes-colou', 700)
  pequena()
  await foto('5-memes-860', 1500)
  await aba('inicio')
  await foto('6-inicio-860')
  normal()

  set({ baixador: { estado: 'baixando', progresso: 0.42, versao: '2026.11.23' } })
  await aba('memes')
  await foto('7-memes-baixando-componente')

  set({ status: 'pausado', baixador: { estado: 'pronto', versao: '2026.11.23' } })
  log('info', '⏸️  Pausado. O figsom parou de atender os comandos, mas a conta continua conectada: clique em Retomar pra voltar, sem QR.')
  await aba('inicio')
  await foto('8-pausado')

  mudarConfig({ baixarLinks: false })
  set({ status: 'deslogado', conta: null, baixador: { estado: 'desligado' } })
  await aba('memes')
  await foto('9-memes-desconectado')
  await js('renderGrade([])')
  await foto('9b-memes-vazia', 500)
  await aba('inicio')
  await foto('10-desconectado')
  app.quit()

  // FIGSOM_DEMO_LINK=<link do X/TikTok>: teste de verdade, COM internet, do caminho do computador:
  // liga a chave pela tela (baixa o yt-dlp pro --user-data-dir), confere a validação dos IPC
  // e baixa o link pelo formulário "Baixar vídeo".
  async function testarLink() {
    mudarConfig({ baixarLinks: false })
    set({ status: 'parado', baixador: { estado: 'desligado' } })
    await aba('memes')
    await foto('11-chave-desligada')
    await js(`document.querySelector('#chk-links').click()`)
    for (let i = 0; i < 240 && estado.baixador?.estado !== 'pronto'; i++) await espera(500)
    await foto('12-componente-pronto')
    const ipc = await js(`Promise.all([
      window.figsom.criarEnviar({ nome: '../segredo' }),
      window.figsom.criarEnviar({ nome: 'tome', modo: 'girar' }),
      window.figsom.criarEnviar({ nome: 'tome', inicio: 5, fim: 2 }),
      window.figsom.criarEnviar({ nome: 'tome', inicio: 'x' }),
      window.figsom.criarEnviar({ nome: 'tome' }),
      window.figsom.baixarLink({ url: 123 }),
      window.figsom.baixarLink({ url: 'https://x.com/a/status/1', nome: {} }),
      window.figsom.baixarLink({ url: 'https://youtu.be/abc' }),
      window.figsom.miniatura('../../segredo'),
      window.figsom.config({ baixarLinks: 'sim', apagarPedido: 1, apagarComando: true }).then((c) => c.config),
    ])`)
    console.log('IPC com argumentos ruins:', JSON.stringify(ipc, null, 1))
    await js(`document.querySelector('#in-link').value = ${JSON.stringify(process.env.FIGSOM_DEMO_LINK)};
      document.querySelector('#in-nome').value = 'Teste do Demo';
      document.querySelector('#btn-baixar').click()`)
    for (let i = 0; i < 240; i++) {
      await espera(500)
      if (await js(`['ok', 'aviso', 'erro'].includes(document.querySelector('#baixar-resultado').dataset.tipo)`)) break
    }
    console.log('resultado:', await js(`document.querySelector('#baixar-resultado').textContent`))
    await foto('13-baixou-link', 2500)
    app.quit()
  }
}
