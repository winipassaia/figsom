<p align="center">
  <img src="build/icon.png" width="112" alt="">
</p>

<h1 align="center">figsom</h1>

<p align="center">Crie <strong>figurinhas com som</strong> no WhatsApp a partir de qualquer vídeo, mesmo que o recurso oficial ainda não tenha chegado pra sua conta.</p>

<p align="center">
  <a href="https://github.com/winipassaia/figsom/releases/latest"><strong>Baixar pra Windows e Linux</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/TUTORIAL.md">Tutorial</a>
  &nbsp;·&nbsp;
  <a href="docs/FORMATO.md">Como funciona</a>
</p>

<p align="center">
  <img src="docs/img/conectado.png" width="760" alt="Janela do figsom conectado, com o guia de uso e o quadro de atividade">
</p>

Mande um vídeo na conversa com você mesmo, responda com `!som`, e a figurinha volta com o áudio do próprio vídeo. Depois é só salvar e usar pelo teclado de figurinhas.

> [!WARNING]
> **Projeto não oficial, use por sua conta e risco.**
> O figsom se conecta ao WhatsApp como um aparelho vinculado usando o [Baileys](https://github.com/WhiskeySockets/Baileys), um cliente **não oficial**. Isso viola os Termos de Serviço do WhatsApp e **pode levar ao banimento da conta**, mesmo em uso pessoal e com pouco volume. Não dá pra medir esse risco.
> O formato da figurinha com som foi descoberto por engenharia reversa. Se a sua conta ainda não tem o recurso, você vai enviar algo que o WhatsApp ainda não liberou pra ela.
> Se possível, use um número secundário. Não use pra spam nem pra enviar em massa.
> Este projeto não tem nenhuma ligação com o WhatsApp ou a Meta.

---

## Baixar

Na página de **[Releases](https://github.com/winipassaia/figsom/releases/latest)**:

| Sistema | Arquivo |
|---|---|
| **Windows** | `figsom-…-instalador-windows.exe` (ou o `…-portatil-windows.exe`, que não instala) |
| **Ubuntu / Debian** | `figsom-…-linux.deb` |
| **Outras distros Linux** | `figsom-…-linux.AppImage` |

Já vem tudo dentro: não precisa instalar Node.js nem ffmpeg. As somas SHA-256 de cada arquivo ficam no `SHA256SUMS.txt` da release. Na primeira vez, o Windows mostra "O Windows protegeu o computador" porque o app não tem assinatura digital. Clique em **Mais informações → Executar assim mesmo**.

**Primeira vez?** Siga o **[tutorial passo a passo](docs/TUTORIAL.md)**.

## Como funciona

1. O figsom conecta no seu WhatsApp como um aparelho vinculado, igual ao WhatsApp Web, pelo QR code.
2. Na conversa com você mesmo (**"Você"**), você manda um vídeo e responde com `!som`.
3. O figsom converte o vídeo em **WebP animado 512×512** e o áudio em **OGG/Opus** (até 10 s).
4. Ele envia a figurinha com som nessa mesma conversa.
5. Você toca nela, **salva nas figurinhas** e manda pra quem quiser pelo teclado.

> [!NOTE]
> **Encaminhar a figurinha perde o áudio.** Use sempre a figurinha salva, pelo teclado.

O figsom só aceita comandos na conversa "Você", não guarda mensagens de ninguém e não baixa histórico. A pasta da sessão guarda só o que o protocolo do WhatsApp exige pra funcionar (chaves de criptografia e identificadores de contatos), como qualquer aparelho vinculado.

Um `!som` mandado com o figsom fechado é atendido quando ele abrir de novo.

## Comandos

Todos na conversa **"Você"**:

| Comando | O que faz |
|---|---|
| `!som` (respondendo um vídeo) | Transforma o vídeo em figurinha com o áudio dele |
| `!som nome` | Usa os arquivos da pasta de memes |
| `!som lista` | Lista os memes da pasta |

**Opções** (combináveis, em qualquer ordem):

| Opção | Efeito |
|---|---|
| *(nenhuma)* | Figurinha quadrada cortando o **centro** do vídeo |
| `ajustar` | Vídeo **inteiro** no quadrado, com bordas transparentes |
| `2-6` | Usa só do segundo 2 ao 6 (aceita `1,5-4`). Máximo de 10 s. |

Exemplos: `!som 2-6`, `!som ajustar`, `!som tome 3-7 ajustar`.

**Pasta de memes:** no app, use o botão *Abrir pasta de memes* (`Documentos/figsom/memes`). Para `!som nome`, o figsom procura `nome.webp` ou um vídeo (`nome.mp4`, `.mov`, `.webm`, `.mkv`, `.gif`, `.avi`), e um áudio separado (`nome.mp3`, `.ogg`, `.opus`, `.m4a`, `.wav`, `.aac`, `.flac`). O áudio separado é opcional pra vídeos com som, mas obrigatório pra `.gif` e `.webp`, que não têm áudio. Use só o nome do arquivo, sem pastas.

Limites: vídeos de até 100 MB, e no máximo 10 s viram figurinha.

> [!TIP]
> **Figurinha parada (sem animar)?** O WhatsApp só anima figurinhas de até ~1 MB. O figsom reduz a qualidade pra caber, mas um vídeo com muito movimento ou detalhe pode passar disso mesmo assim. O tamanho aparece na mensagem de envio, por exemplo "(354 KB, 6s)". Se passar de ~1000 KB, use um trecho menor, como `!som 0-5`. As figurinhas oficiais costumam ter de 3 a 5 s.

## Dicas de segurança

- Quando terminar de criar figurinhas, clique em **Pausar** ou feche o figsom. Os dois desligam a conexão sem desconectar a conta, e pra voltar não precisa de QR. Use **Desconectar conta** só quando for parar de usar de vez.
- Mantenha o backup das conversas em dia.
- Se aparecer algum aviso de "app não oficial", pare de usar.
- Não transforme isso num bot público no seu número principal.
- Pra parar de usar, clique em **Desconectar conta** antes de desinstalar. Desinstalar apaga a sessão do computador, mas não tira o figsom da lista de **Aparelhos conectados** do celular.
- Confira de vez em quando a lista de **Aparelhos conectados**. O figsom aparece lá como um navegador (Chrome no Mac OS), porque é assim que a biblioteca se identifica.

## Para desenvolvedores

```bash
git clone https://github.com/winipassaia/figsom.git
cd figsom
npm install
npm run app      # app com janela (Electron)
npm start        # modo terminal
npm test         # formato da figurinha + conversão (precisa de ffmpeg)
```

O modo terminal precisa do ffmpeg no PATH. Guias: [Windows](docs/TERMINAL.md) e [Linux](docs/LINUX.md).

O app usa o ffmpeg de `vendor/ffmpeg/` (ou o do PATH, se não houver). Pra empacotar localmente (`npm run dist:win` / `dist:linux`), ponha lá um ffmpeg com `libwebp` e `libopus`: o mesmo build LGPL que o workflow baixa (veja o topo do `release.yml`). Os testes usam o ffmpeg do PATH ou o da variável `FIGSOM_FFMPEG`.

| Pasta | Conteúdo |
|---|---|
| `src/` | Núcleo: conexão e comandos (`bot.js`), formato e envio (`enviar.js`), captura e engenharia reversa (`raw.js`, `captura.js`) |
| `app/` | App com janela (Electron): processo principal, ponte segura e interface |
| `index.js` | Modo terminal |
| `.github/workflows/release.yml` | Gera os instaladores e publica a release a cada tag `v*` |

### Por baixo dos panos

O WhatsApp lançou as figurinhas com som em novembro de 2026, mas o Baileys ainda não conhece o formato. Ao receber uma dessas, ele mostra uma mensagem vazia. Ao enviar, apaga os campos que não conhece. O figsom descobriu o formato capturando os bytes crus das mensagens e resolve os dois lados com ganchos no protobuf. Detalhes em **[docs/FORMATO.md](docs/FORMATO.md)**.

```
Message
└─ 134: FutureProofMessage        (campo novo)
   └─ 1: Message
      └─ 26: StickerMessage       → WebP animado
         └─ 26: AudioMessage      (campo novo) → OGG/Opus
```

### Publicar uma versão

```bash
npm version patch            # ou minor / major
git push --follow-tags
```

O GitHub Actions confere se a tag bate com a versão do `package.json`, roda os testes com o ffmpeg que vai no app, monta o instalador e o portátil do Windows, o `.deb` e o AppImage do Linux, e publica a release com o `SHA256SUMS.txt`.

Prefira esse caminho a criar a release pelo site: assim ela só aparece quando os arquivos estiverem prontos. Se você criar pelo site mesmo assim, o workflow só anexa os arquivos e mantém as notas que você escreveu.

## Roadmap

- [x] Figurinha 1:1 cortando o centro (padrão) e `ajustar`
- [x] `!som 2-6`: usar só um trecho do vídeo
- [x] App com janela pra Windows e Linux
- [ ] Áudio por link (ex.: MyInstants)
- [ ] Imagem/GIF + áudio respondendo mensagens
- [ ] Editor com prévia dentro do app

## Créditos

- [Baileys](https://github.com/WhiskeySockets/Baileys), cliente WhatsApp Web
- [FFmpeg](https://ffmpeg.org): os instaladores incluem um build LGPL de [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)
- [Electron](https://www.electronjs.org)
- Fonte [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) (OFL)

## Licença

[MIT](LICENSE)
