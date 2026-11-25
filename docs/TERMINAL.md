# Modo terminal (Windows)

Pra quem prefere rodar o figsom pelo código-fonte, sem o app com janela. Os comandos no WhatsApp são os mesmos.

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

A sessão fica salva na pasta `auth/`, ao lado do código. **Nunca compartilhe essa pasta.**

## 5. Use

Igual ao app: veja a [Parte 3 do tutorial](TUTORIAL.md#parte-3-criar-figurinhas-com-som). No modo terminal, a pasta de memes é a `memes/` dentro do projeto.

Pra desligar, use **Ctrl + C**.

## Configuração

No topo do `index.js`:

| Opção | Padrão | Descrição |
|---|---|---|
| `memesDir` | `memes` | Pasta dos memes |
| `authDir` | `auth` | Sessão do WhatsApp |
| `apagarComando` | `true` | Apaga a mensagem `!som` depois de enviar |
| `soConversaComigo` | `true` | Só aceita comandos na conversa "Você" |
| `capturar` | `false` | Modo estudo: salva figurinhas com som **recebidas** em `dumps/`. Veja [FORMATO.md](FORMATO.md). |

## Problemas comuns

| Problema | Solução |
|---|---|
| `'node' não é reconhecido...` | O Node.js não foi instalado, ou o Prompt foi aberto antes. Reabra o Prompt. |
| `ffmpeg não encontrado` | Volte ao passo 1 e **reabra o terminal** depois do `winget`. |
| `Rode de novo para escanear um novo QR.` | Você desconectou pelo celular. Rode de novo e escaneie. |
