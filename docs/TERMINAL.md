# Modo terminal (Windows)

Pra quem prefere rodar o figsom pelo código-fonte, sem o app com janela. Os comandos no WhatsApp são os mesmos (`!criar`, `!salvar`, `!memes`, `!ajuda`). A aba Memes, com a biblioteca e o **Criar e enviar**, só existe no app.

> Só quer usar? O jeito fácil é o **[app](TUTORIAL.md)**. No Linux, veja o **[modo terminal no Linux](LINUX.md)**.

## 1. Instale o Node.js e o ffmpeg

1. Baixe e instale o **Node.js LTS** em https://nodejs.org (precisa ser a versão 20 ou maior).
2. No Prompt de Comando (tecla Windows → `cmd`):
   ```
   winget install ffmpeg
   ```
3. **Feche e abra o Prompt de novo** e confira:
   ```
   node -v
   ffmpeg -version
   ```

## 2. Baixe o figsom

Na página do projeto: botão verde **Code** → **Download ZIP**, e extraia. Ou, com git:
```
git clone https://github.com/winipassaia/figsom.git
```

## 3. Inicie

Dê **dois cliques em `iniciar.bat`**. Ele confere o Node e o ffmpeg, instala as dependências na primeira vez e liga o bot.

Pelo terminal, o equivalente é, dentro da pasta:
```
npm install --omit=dev
npm start
```

## 4. Conecte

Escaneie o QR que aparece no terminal: **WhatsApp → ⋮ → Aparelhos conectados → Conectar um aparelho**.

> Se o QR aparecer quebrado, aumente a janela do terminal ou diminua a fonte (Ctrl + scroll).

A sessão fica salva na pasta `auth/`, ao lado do código. **Nunca compartilhe essa pasta**, e não deixe o projeto dentro de pastas sincronizadas (OneDrive, Dropbox, Syncthing...) sem excluir a `auth/` da sincronização.

> Não rode o modo terminal e o app ao mesmo tempo com a **mesma** sessão. Cada um usa a sua pasta (o app guarda a dele em `%APPDATA%\figsom\auth`), então cada um aparece como um aparelho conectado separado.

## 5. Use

Igual ao app: veja a [Parte 3 do tutorial](TUTORIAL.md#parte-3-criar-figurinhas-com-som). No modo terminal, a pasta de memes é a `memes/` dentro do projeto.

Pra usar `!criar <link>` e `!salvar` (X e TikTok), mude `baixarLinks` pra `true` no `index.js` e reinicie. Na primeira vez, o figsom baixa o yt-dlp (uns 25 MB) da [release oficial](https://github.com/yt-dlp/yt-dlp/releases), confere o SHA-256 e guarda na pasta `bin/` do projeto. Leia o [aviso sobre direitos autorais](TUTORIAL.md#parte-4-baixar-do-x-e-do-tiktok) antes.

Pra desligar, use **Ctrl + C**. É o mesmo que o botão **Pausar** do app: a sessão fica guardada e, da próxima vez, ele conecta sem QR. Pra desconectar a conta de vez, remova o aparelho no celular (**Aparelhos conectados**) e apague a pasta `auth/`.

## Configuração

No topo do `index.js`:

| Opção | Padrão | Descrição |
|---|---|---|
| `memesDir` | `memes` | Pasta dos memes |
| `authDir` | `auth` | Sessão do WhatsApp |
| `binDir` | `bin` | Onde fica o yt-dlp baixado |
| `baixarLinks` | `false` | Liga o `!criar <link>` e o `!salvar` (X e TikTok). Baixa o yt-dlp na primeira vez. |
| `apagarPedido` | `false` | `true` apaga a mensagem do comando depois de enviar a figurinha. Com `false`, o figsom só reage ✅ (ou ❌) nela |
| `soConversaComigo` | `true` | Só aceita comandos na conversa "Você" |
| `capturar` | `false` | Modo estudo: salva em `dumps/` as figurinhas **recebidas** de qualquer conversa, inclusive de outras pessoas. Veja [FORMATO.md](FORMATO.md). |

## Problemas comuns

| Problema | Solução |
|---|---|
| `'node' não é reconhecido...` | O Node.js não foi instalado, ou o Prompt foi aberto antes. Reabra o Prompt. |
| `ffmpeg não encontrado` | Volte ao passo 1 e **reabra o terminal** depois do `winget`. |
| `Rode de novo para escanear um novo QR.` | Você desconectou pelo celular. Rode de novo e escaneie. |
| `Baixar de links (X e TikTok) está desligado` | Mude `baixarLinks` pra `true` no `index.js` e reinicie. |
| `Não consegui baixar o yt-dlp do GitHub` | Confira a internet. Se o antivírus apagou o arquivo, apague a pasta `bin/` e rode de novo. |
