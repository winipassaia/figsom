# Tutorial: como usar o figsom

Guia pra quem só quer baixar e usar: não precisa instalar Node.js, ffmpeg nem abrir terminal. Leva uns 5 minutos.

> Prefere rodar pelo terminal? Veja o [modo terminal no Windows](TERMINAL.md) ou [no Linux](LINUX.md).

> [!WARNING]
> O figsom é **não oficial** e se conecta ao seu WhatsApp como um aparelho vinculado. Isso viola os termos do WhatsApp e **pode causar banimento**, mesmo em uso pessoal. Não dá pra medir esse risco. Se puder, use um número secundário.

---

## Parte 1: Instalar

### Windows

1. Abra a página de **[Releases](https://github.com/winipassaia/figsom/releases/latest)**.
2. Baixe o **`figsom-…-instalador-windows.exe`**.
3. Abra o arquivo. Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações** e depois em **Executar assim mesmo**.
   > O aviso aparece porque o figsom não tem assinatura digital, um certificado pago. O código está todo aberto no GitHub.
4. Siga o instalador. No fim, o figsom abre sozinho e ganha um atalho no menu Iniciar.

> Não quer instalar? Baixe o **`figsom-…-portatil-windows.exe`** e abra direto. Ele demora alguns segundos a mais pra abrir.

### Linux: Ubuntu, Debian, Mint e derivados

1. Na página de **[Releases](https://github.com/winipassaia/figsom/releases/latest)**, baixe o **`figsom-…-linux.deb`**.
2. Instale pelo terminal, na pasta onde ele foi baixado:
   ```bash
   sudo apt install ./figsom-*-linux.deb
   ```
3. Abra o **figsom** pelo menu de aplicativos.

> Use o `.deb` no Ubuntu 24.04 ou mais novo: ele instala a permissão de segurança (AppArmor) que o app precisa pra abrir. O AppImage costuma fechar sem abrir nessas versões.

### Linux: outras distros (AppImage)

1. Baixe o **`figsom-…-linux.AppImage`**.
2. Dê permissão de execução: botão direito → Propriedades → Permissões → "Permitir executar como programa", ou no terminal:
   ```bash
   chmod +x figsom-*-linux.AppImage
   ```
3. Abra com dois cliques.

> Se o AppImage pedir FUSE, instale o `libfuse2` (no Ubuntu 24.04 o pacote se chama `libfuse2t64`).

---

## Parte 2: Conectar no WhatsApp

![Tela do QR code](img/qr.png)

1. Na primeira vez, o figsom mostra um **aviso** explicando os riscos. Leia e clique em **Entendi, quero continuar**.
2. Aparece um **QR code**.
3. No celular, abra o WhatsApp, toque em **⋮ (Mais opções)**, depois em **Aparelhos conectados** e em **Conectar um aparelho**.
4. Aponte a câmera pro QR na tela do computador.

Quando conectar, aparece **"Tudo pronto!"** e o selo no canto fica verde: **Conectado**.

Nas próximas vezes, é só abrir o figsom, que ele conecta sozinho, sem QR.

---

## Parte 3: Criar figurinhas com som

![Tela conectada, com a atividade](img/conectado.png)

### 1. Abra a conversa com você mesmo

No WhatsApp, toque em **Nova conversa** e escolha **o seu próprio contato**, que aparece como **"(Você)"** ou **"Mensagem para você"**.

O figsom **só obedece comandos nessa conversa**.

### 2. Mande um vídeo e responda com `!som`

1. Envie um vídeo curto nessa conversa. O figsom usa no máximo **10 segundos**. Pra vídeos com muito movimento, 3 a 5 segundos funcionam melhor (a figurinha precisa ficar com até ~1 MB pra animar).
2. **Segure o dedo no vídeo** e toque em **Responder**.
3. Escreva `!som` e envie.

No figsom, o quadro **Atividade** mostra cada etapa: baixando, convertendo, enviando. Em alguns segundos a **figurinha com som** chega na conversa, com um ícone de áudio.

### 3. Salve e use

1. Toque na figurinha.
2. Toque em **Adicionar às figurinhas** (ou na ⭐).
3. Pronto: ela fica no seu **teclado de figurinhas** pra mandar em qualquer conversa.

> [!IMPORTANT]
> **Não encaminhe a figurinha**, porque encaminhar perde o som. Mande sempre pelo teclado de figurinhas.

### Variações do `!som`

| Comando | Resultado |
|---|---|
| `!som` | Figurinha **quadrada**, cortando o **centro** do vídeo (padrão) |
| `!som ajustar` | Vídeo **inteiro** dentro do quadrado, com bordas transparentes |
| `!som 2-6` | Usa só do segundo **2** ao **6** |
| `!som 1,5-4 ajustar` | Dá pra combinar |

### Pasta de memes

O botão **Abrir pasta de memes** abre `Documentos/figsom/memes`. Coloque arquivos lá e use pelo nome, sem precisar mandar o vídeo pelo WhatsApp:

| Arquivos na pasta | Comando |
|---|---|
| `tome.mp4` | `!som tome` |
| `gato.gif` + `gato.mp3` | `!som gato` (GIF com o som do mp3) |
| `pronta.webp` + `pronta.ogg` | `!som pronta` |

As variações também funcionam aqui: `!som tome 3-7 ajustar`. `!som lista` manda a lista dos memes da pasta.

GIF e `.webp` não têm som: eles sempre precisam de um áudio com o mesmo nome. Use só o nome do arquivo no comando, sem pastas.

### Pausar, desligar e desconectar

Tem dois botões no canto de baixo, e eles fazem coisas bem diferentes:

| | **Pausar** | **Desconectar conta** |
|---|---|---|
| O que faz | Para de atender o `!som`. A conta continua vinculada. | Tira o figsom dos aparelhos conectados e apaga a sessão do computador. |
| Pra voltar | Clique em **Retomar**. Não precisa de QR. | Só escaneando o QR de novo. |
| Quando usar | Quer deixar o figsom quieto por um tempo, sem fechar a janela. | Vai parar de usar, trocar de conta ou desinstalar. |

- **Fechar a janela** faz o mesmo que Pausar: desliga o figsom sem desconectar a conta. Ele não fica rodando escondido, e na próxima vez que você abrir, ele conecta sozinho, sem QR.
- Um `!som` mandado com o figsom pausado ou fechado é atendido quando você retomar ou abrir ele de novo.
- Pra desconectar estando pausado, clique em **Retomar** antes: o figsom precisa estar conectado pra avisar o WhatsApp.
- Se clicar em **Desconectar conta** sem internet, ele apaga a sessão mesmo assim e avisa: aí confira no celular, em **Aparelhos conectados**, e remova o figsom de lá.
- **Antes de desinstalar, clique em Desconectar conta.** Desinstalar apaga a sessão do computador, mas o figsom continua na lista de aparelhos conectados do celular até você remover.
- Na lista de **Aparelhos conectados** do celular, o figsom aparece como um navegador (Chrome no Mac OS).

---

## Problemas comuns

| Problema | Solução |
|---|---|
| "O Windows protegeu o computador" | **Mais informações** → **Executar assim mesmo**. |
| O QR não aparece e fica em "Conectando…" | Confira sua internet. A Atividade mostra se ele está tentando de novo. |
| `!som` não faz nada | Confira se está na conversa **"Você"** e se **respondeu** o vídeo (segurar → Responder). |
| A figurinha chegou sem som | Ela foi encaminhada. Mande pelo teclado de figurinhas. |
| A figurinha cortou uma parte importante | Use `!som ajustar`. |
| A figurinha chegou parada, sem animar | Ela passou de ~1 MB, o limite pra animar. Isso acontece com vídeos com muito movimento ou detalhe. Veja o tamanho na Atividade (ex.: "1200 KB") e use um trecho menor, como `!som 0-5`. |
| "Esse vídeo não tem áudio" | Ele não tem som (GIFs do WhatsApp nunca têm). Use outro vídeo, ou ponha o meme na pasta com um áudio de mesmo nome. |
| "Não sobrou nada no trecho" | O trecho do `!som 2-6` passa do fim do vídeo. Use segundos que existam no vídeo. |
| "Não consegui baixar o vídeo" | O vídeo é antigo e saiu do servidor do WhatsApp. Mande ele de novo e responda com `!som`. |
| "Esta sessão foi aberta em outro lugar" | Tem outra janela do figsom (ou o modo terminal com a mesma sessão) aberta. Feche a outra e clique em **Conectar WhatsApp**. |
| "O WhatsApp recusou a conexão (403)" | O WhatsApp bloqueou o acesso. Abra o WhatsApp no celular pra ver se a conta tem algum aviso, e pare de usar o figsom nessa conta. |
| Desconectei pelo celular | Abra o figsom de novo e escaneie o novo QR. |
| Linux: o app fecha sem abrir (Ubuntu 24.04+) | Use o `.deb` em vez do AppImage. |
| AppImage não abre no Linux | `chmod +x` no arquivo e, se pedir FUSE, instale o `libfuse2` (`libfuse2t64` no Ubuntu 24.04). |

## Onde ficam os dados

| | Windows | Linux |
|---|---|---|
| Sessão do WhatsApp | `%APPDATA%\figsom\auth` | `~/.config/figsom/auth` |
| Pasta de memes | `Documentos\figsom\memes` | `~/Documentos/figsom/memes` (ou `~/Documents`) |

> [!CAUTION]
> A pasta `auth` dá acesso total ao seu WhatsApp. Nunca compartilhe, e não deixe ela dentro de pastas sincronizadas (OneDrive, Dropbox, Syncthing...). Pra apagar, use **Desconectar conta**.
