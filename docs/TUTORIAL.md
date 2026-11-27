# Tutorial: como usar o figsom

Guia pra quem só quer baixar e usar: não precisa instalar Node.js, ffmpeg nem abrir terminal. Leva uns 5 minutos.

> Prefere rodar pelo terminal? Veja o [modo terminal no Windows](TERMINAL.md) ou [no Linux](LINUX.md).

> [!WARNING]
> O figsom é **não oficial** e se conecta ao seu WhatsApp como um aparelho vinculado, o que vai contra os termos do WhatsApp. **O risco de banimento é baixo**: o figsom só age na sua própria conta, na conversa com você mesmo, e nunca manda mensagem pra outras pessoas, que é o que costuma levar a ban. Mas não é zero, então use um número secundário se puder.

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

O figsom **só obedece comandos na conversa com você mesmo**, a "Você".

#### Como achar a conversa "Você"

- **Celular (Android ou iPhone):** toque em **Nova conversa**. O primeiro contato é você, com **"(Você)"** ou **"Mensagem para você"**.
- **WhatsApp Web ou Desktop:** **Nova conversa** → o seu contato, no topo da lista.
- **Não apareceu?** Busque pelo seu nome, ou abra `wa.me/` seguido do seu número no navegador do celular (ex.: `wa.me/5511999998888`).
- **Dica:** fixe a conversa pra ela ficar sempre no topo.

Mais detalhes no [README](../README.md#como-achar-a-conversa-você).

### 2. Mande um vídeo e responda com `!criar`

> Também vale responder uma mensagem com link do X ou do TikTok: veja a [Parte 4](#parte-4-baixar-do-x-e-do-tiktok).

1. Envie um vídeo curto nessa conversa. O figsom usa no máximo **10 segundos**. Pra vídeos com muito movimento, 3 a 5 segundos funcionam melhor (a figurinha precisa ficar com até ~1 MB pra animar).
2. **Segure o dedo no vídeo** e toque em **Responder**.
3. Escreva `!criar` e envie.

O figsom reage ao seu `!criar` com ⏳ enquanto trabalha. Em alguns segundos a **figurinha com som** chega na conversa, com um ícone de áudio, e a reação vira ✅. Se der algo errado, ela vira ❌, e o quadro **Atividade** do figsom mostra o motivo e cada etapa: baixando, convertendo, enviando.

> A mensagem do comando fica na conversa. Se preferir que ela suma depois de enviar, ligue **Apagar o comando depois de enviar**, no rodapé do figsom.

> Usava o `!som` da versão 1.0? Ele continua funcionando, igual ao `!criar`.

### 3. Salve e use

1. Toque na figurinha.
2. Toque em **Adicionar às figurinhas** (ou na ⭐).
3. Pronto: ela fica no seu **teclado de figurinhas** pra mandar em qualquer conversa.

Quem tocar na figurinha vê "Criado pelo APP figsom" e, embaixo, "github @winipassaia".

> [!IMPORTANT]
> **Não encaminhe a figurinha**, porque encaminhar perde o som. Mande sempre pelo teclado de figurinhas.

### Opções do `!criar`

| Comando | Resultado |
|---|---|
| `!criar` | Figurinha **quadrada**, cortando o **centro** do vídeo (padrão) |
| `!criar ajustar` | Vídeo **inteiro** dentro do quadrado, com bordas transparentes |
| `!criar 2-6` | Usa só do segundo **2** ao **6** |
| `!criar 1,5-4 ajustar` | Dá pra combinar |

Mande `!ajuda` na conversa "Você" pra receber a lista de comandos no próprio WhatsApp.

### Pasta de memes

O botão **Pasta de memes** (no rodapé) abre `Documentos/figsom/memes`. Coloque arquivos lá e use pelo nome, sem precisar mandar o vídeo pelo WhatsApp:

| Arquivos na pasta | Comando |
|---|---|
| `tome.mp4` | `!criar tome` |
| `gato.gif` + `gato.mp3` | `!criar gato` (GIF com o som do mp3) |
| `pronta.webp` + `pronta.ogg` | `!criar pronta` |

As opções também funcionam aqui: `!criar tome 3-7 ajustar`. `!memes` manda a lista dos memes da pasta.

GIF e `.webp` não têm som: eles sempre precisam de um áudio com o mesmo nome. Use só o nome do arquivo no comando, sem pastas.

### Pausar, desligar e desconectar

Tem dois botões no canto de baixo, e eles fazem coisas bem diferentes:

| | **Pausar** | **Desconectar conta** |
|---|---|---|
| O que faz | Para de atender os comandos. A conta continua vinculada. | Tira o figsom dos aparelhos conectados e apaga a sessão do computador. |
| Pra voltar | Clique em **Retomar**. Não precisa de QR. | Só escaneando o QR de novo. |
| Quando usar | Quer deixar o figsom quieto por um tempo, sem fechar a janela. | Vai parar de usar, trocar de conta ou desinstalar. |

- **Fechar a janela** faz o mesmo que Pausar: desliga o figsom sem desconectar a conta. Ele não fica rodando escondido, e na próxima vez que você abrir, ele conecta sozinho, sem QR.
- Um comando mandado com o figsom pausado ou fechado é atendido quando você retomar ou abrir ele de novo.
- Pra desconectar estando pausado, clique em **Retomar** antes: o figsom precisa estar conectado pra avisar o WhatsApp.
- Se clicar em **Desconectar conta** sem internet, ele apaga a sessão mesmo assim e avisa: aí confira no celular, em **Aparelhos conectados**, e remova o figsom de lá.
- **Antes de desinstalar, clique em Desconectar conta.** Desinstalar apaga a sessão do computador, mas o figsom continua na lista de aparelhos conectados do celular até você remover.
- Na lista de **Aparelhos conectados** do celular, o figsom aparece como um navegador (Chrome no Mac OS).

---

## Parte 4: Baixar do X e do TikTok

![Aba Memes, com o download por link e a biblioteca](img/memes.png)

O figsom também cria figurinhas a partir de **posts públicos com vídeo do X (Twitter) e do TikTok**. YouTube não é suportado.

> [!CAUTION]
> **Baixar vídeos pode violar os termos de uso do X e do TikTok e os direitos autorais de quem fez o vídeo.** Use só pra uso pessoal, com conteúdo que você pode usar.

### Ligar

1. No figsom, abra a aba **Memes**.
2. Ligue a chave **Baixar de links (X e TikTok)**.
3. O figsom baixa o componente de download, o **yt-dlp** (uns 25 MB), da página oficial dele e confere se o arquivo é o original. O andamento aparece na Atividade. Isso só acontece uma vez; depois ele procura versão nova no máximo uma vez por semana.

A chave vem desligada: sem ela, nada é baixado e os comandos com link respondem explicando como ligar.

### Usar pelo celular

Copie o link do post (no app do X ou do TikTok: **Compartilhar → Copiar link**). Aí, na conversa "Você", tem dois jeitos que dão no mesmo:

- **Cole o link, segure em cima dele → Responder → `!criar`**, igual faz com vídeo.
- Ou mande tudo de uma vez: `!criar` seguido do link.

| Comando | Resultado |
|---|---|
| `!criar <link>` (ou respondendo o link com `!criar`) | Baixa os 10 primeiros segundos e manda a figurinha |
| `!criar <link> 5-12 ajustar` | As opções do `!criar` valem aqui também |
| `!salvar <link> gato` | Guarda o vídeo (até 60 s) na pasta de memes como `gato`. Depois é só `!criar gato`. |
| `!salvar <link>` | Sem nome, ele usa as primeiras palavras do post. A resposta diz o nome salvo. |

O `!salvar` nunca apaga nada: se já existir um `gato`, ele salva como `gato-2` e avisa.

### Usar pelo computador (aba Memes)

- **Baixar vídeo:** cole o link, dê um nome se quiser e clique em **Baixar**. O vídeo vai pra pasta de memes.
- **Biblioteca:** mostra os memes da pasta, com miniatura. Escolha as opções em cima (**Ajustar** e **Trecho**) e clique em **Criar e enviar**: a figurinha chega na sua conversa "Você". Esse botão só funciona com o figsom conectado.

---

## Problemas comuns

| Problema | Solução |
|---|---|
| "O Windows protegeu o computador" | **Mais informações** → **Executar assim mesmo**. |
| O QR não aparece e fica em "Conectando…" | Confira sua internet. A Atividade mostra se ele está tentando de novo. |
| `!criar` não faz nada (nem aparece o ⏳) | Confira se está na conversa **"Você"** ([como achar](#como-achar-a-conversa-você)) e se o figsom está aberto e **Conectado**. Se estiver tudo certo e mesmo assim nada acontecer, clique em **Desconectar conta** e conecte de novo pelo QR. Quem vinculou na 1.1.0 precisa fazer isso uma vez: o figsom avisa na Atividade. |
| O comando ficou com ❌ | Deu erro: o motivo aparece na **Atividade** do figsom (nos comandos com link, ele também responde na conversa). O mais comum é esquecer de **responder** o vídeo (segurar → Responder). |
| O figsom parou de apagar o `!som` | Na versão 1.1, a mensagem do comando fica e ganha um ✅. Pra voltar a apagar, ligue **Apagar o comando depois de enviar** no rodapé. |
| A figurinha chegou sem som | Ela foi encaminhada. Mande pelo teclado de figurinhas. |
| A figurinha cortou uma parte importante | Use `!criar ajustar`. |
| A figurinha chegou parada, sem animar | Ela passou de ~1 MB, o limite pra animar. Isso acontece com vídeos com muito movimento ou detalhe. Veja o tamanho na Atividade (ex.: "1200 KB") e use um trecho menor, como `!criar 0-5`. |
| "Esse vídeo não tem áudio" / "não tem som" | Ele não tem som (GIFs do WhatsApp e todo "GIF" do X nunca têm). Use outro vídeo, ou ponha o meme na pasta com um áudio de mesmo nome. |
| "Não sobrou nada no trecho" | O trecho do `!criar 2-6` passa do fim do vídeo. Use segundos que existam no vídeo. |
| "Não consegui baixar o vídeo" | O vídeo é antigo e saiu do servidor do WhatsApp. Mande ele de novo e responda com `!criar`. |
| "Baixar de links (X e TikTok) está desligado" | Abra a aba **Memes** no figsom e ligue a chave. |
| "YouTube não é suportado" / "Só dá pra baixar do X e do TikTok" | O figsom só baixa de posts do X e do TikTok. |
| "Esse post é privado…" | O post é privado, tem restrição de idade ou pede login. O figsom não entra na sua conta do X nem do TikTok, então só baixa posts públicos. |
| "Não achei esse post" / "Esse link não leva a um post com vídeo" | O post foi apagado, o link está incompleto ou é de um perfil. Copie de novo pelo **Compartilhar → Copiar link** do post. |
| "Esse post não tem vídeo" | O post só tem foto ou texto. |
| "O site bloqueou o download agora" | Acontece às vezes. Espere alguns minutos e tente de novo. |
| "Não consegui baixar o yt-dlp" | Confira a internet e desligue e ligue a chave **Baixar de links** de novo. Se o antivírus apagou o arquivo, isso também resolve. |
| **Criar e enviar** está apagado | O figsom precisa estar **Conectado** pra mandar a figurinha. |
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
| yt-dlp (só se ligar "Baixar de links") | `%APPDATA%\figsom\bin` | `~/.config/figsom/bin` |
| Miniaturas da aba Memes | `%APPDATA%\figsom\miniaturas` | `~/.config/figsom/miniaturas` |

> [!CAUTION]
> A pasta `auth` dá acesso total ao seu WhatsApp. Nunca compartilhe, e não deixe ela dentro de pastas sincronizadas (OneDrive, Dropbox, Syncthing...). Pra apagar, use **Desconectar conta**.
