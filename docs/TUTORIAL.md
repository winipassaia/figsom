# Tutorial: instalação e uso do figsom

Guia pra quem nunca usou terminal. Leva uns 10 minutos. A instalação aqui é pro **Windows**. **No Linux, siga o [guia de Linux](LINUX.md)** e depois volte pra [Parte 3](#parte-3-criar-figurinhas-com-som).

> [!WARNING]
> O figsom é **não oficial** e conecta no seu WhatsApp como um aparelho vinculado. Isso viola os termos do WhatsApp e **pode causar banimento**. O risco é baixo pra uso pessoal, mas existe. Se puder, use um número secundário. Leia a seção [Dicas de segurança](../README.md#dicas-de-segurança).

---

## Parte 1: Instalação (só na primeira vez)

### 1. Instale o Node.js

1. Acesse **https://nodejs.org** e baixe a versão **LTS**.
2. Instale com as opções padrão (Avançar, Avançar, Concluir).
3. Pra conferir, abra o **Prompt de Comando** (tecla Windows, digite `cmd`, Enter) e rode:
   ```
   node -v
   ```
   Tem que aparecer `v20` ou maior, por exemplo `v22.11.0`.

### 2. Instale o ffmpeg

O ffmpeg converte o vídeo em figurinha e o áudio em OGG.

- **Windows:** no Prompt de Comando, rode:
  ```
  winget install ffmpeg
  ```
  Depois **feche e abra o Prompt de novo**. Isso é obrigatório pro comando ser reconhecido.
- **Ubuntu/Debian:** `sudo apt install ffmpeg`
- **macOS:** `brew install ffmpeg`

Pra conferir:
```
ffmpeg -version
```
Tem que aparecer um texto começando com `ffmpeg version ...`.

### 3. Baixe o figsom

**Jeito fácil:** na página do projeto no GitHub, clique no botão verde **Code**, depois em **Download ZIP**, e extraia numa pasta fácil de achar, por exemplo `Documentos\figsom`.

**Com git:**
```
git clone https://github.com/winipassaia/figsom.git
```

> [!TIP]
> **Atalho:** depois de instalar o Node.js e o ffmpeg e de extrair o ZIP, você pode só dar **dois cliques no `iniciar.bat`** dentro da pasta. Ele confere tudo, instala as dependências na primeira vez e liga o bot. Com isso, os passos 4 a 6 viram um clique só.

### 4. Abra o terminal dentro da pasta

- **Windows:** abra a pasta `figsom` no Explorador de Arquivos, clique na **barra de endereço**, apague o que estiver escrito, digite `cmd` e aperte Enter. O Prompt abre já dentro da pasta.
- **Linux/macOS:** `cd caminho/para/figsom`

### 5. Instale as dependências

```
npm install
```
Espere terminar. Pode levar 1 ou 2 minutos, e avisos (`warn`) são normais.

---

## Parte 2: Conectar no WhatsApp

### 6. Ligue o bot

```
npm start
```
Vai aparecer um **QR code** no terminal.

> Se o QR aparecer quebrado ou cortado, aumente a janela do terminal ou diminua a fonte (Ctrl + scroll do mouse).

### 7. Escaneie o QR

No celular:

1. Abra o WhatsApp.
2. Toque nos **três pontinhos (⋮)** e depois em **Aparelhos conectados**.
3. Toque em **Conectar um aparelho**.
4. Aponte a câmera pro QR no terminal.

Quando conectar, o terminal mostra:
```
✅ Conectado — comandos só na conversa "Você". ...
```

Da próxima vez que rodar `npm start`, **não precisa escanear de novo**. A sessão fica salva na pasta `auth/`.

> [!CAUTION]
> A pasta `auth/` dá acesso total ao seu WhatsApp. **Nunca mande ela pra ninguém.**

---

## Parte 3: Criar figurinhas com som

### 8. Abra a conversa com você mesmo

No WhatsApp, toque em **Nova conversa** (o ícone de mensagem) e escolha **o seu próprio contato**, que aparece no topo como **"(Você)"** ou **"Mensagem para você"**.

O bot **só obedece comandos nessa conversa**.

### 9. Mande um vídeo e responda com `!som`

1. Envie um vídeo nessa conversa. Vídeos curtos funcionam melhor; o bot usa no máximo **10 segundos**.
2. **Segure o dedo no vídeo** e toque em **Responder**.
3. Escreva:
   ```
   !som
   ```
4. Envie e espere alguns segundos.

No terminal aparece:
```
🎬 !som (resposta a vídeo) → ...
   ✅ enviada (574 KB, 10s)
```
A **figurinha com som** chega na conversa, com um ícone de áudio. A mensagem `!som` é apagada sozinha.

### Opções do `!som`

Dá pra combinar opções em qualquer ordem:

| Comando | Resultado |
|---|---|
| `!som` | Figurinha **quadrada**, cortando o **centro** do vídeo (padrão) |
| `!som ajustar` | Vídeo **inteiro** dentro do quadrado, com bordas transparentes |
| `!som 2-6` | Usa só do segundo **2** ao **6** (imagem e som) |
| `!som 1,5-4 ajustar` | Trecho de 1,5 s a 4 s, com o vídeo inteiro |

O limite é de **10 segundos**. Se o trecho for maior, ele é cortado nos 10 s.

### 10. Salve e use

1. Toque na figurinha que chegou.
2. Toque em **Adicionar às figurinhas** (ou na ⭐ pra favoritar).
3. Pronto: ela aparece no seu **teclado de figurinhas** e você pode mandar em qualquer conversa.

> [!IMPORTANT]
> **Não encaminhe a figurinha**, porque encaminhar perde o som. Mande sempre pelo teclado de figurinhas.

### 11. (Opcional) Use a pasta `memes/`

Pra criar sem mandar o vídeo pelo WhatsApp, coloque os arquivos na pasta `memes/` do figsom:

| Arquivos na pasta | Comando | Resultado |
|---|---|---|
| `tome.mp4` | `!som tome` | Vídeo + áudio do próprio vídeo |
| `gato.gif` + `gato.mp3` | `!som gato` | GIF com o áudio do mp3 |
| `pronta.webp` + `pronta.ogg` | `!som pronta` | Figurinha que você já tem + som |

As opções também funcionam aqui: `!som tome 3-7`, `!som gato ajustar`. `!som lista` mostra tudo que tem na pasta.

### 12. Desligue quando terminar

No terminal, aperte **Ctrl + C**.

Pra desconectar de vez: no celular, vá em **Aparelhos conectados**, toque no aparelho do bot e depois em **Desconectar**.

---

## Problemas comuns

| Problema | Solução |
|---|---|
| `'node' não é reconhecido...` | O Node.js não foi instalado, ou o Prompt foi aberto antes da instalação. Feche e abra o Prompt de novo. |
| `spawn ffmpeg ENOENT` ou `instala o ffmpeg` | O ffmpeg não está instalado ou o terminal não foi reaberto. Volte ao passo 2. |
| O QR expirou | Ele se renova sozinho. Se não renovar, aperte Ctrl + C e rode `npm start` de novo. |
| `Deslogado. Apaga a pasta auth/` | Você desconectou pelo celular. Apague a pasta `auth/` e escaneie de novo. |
| `!som` não faz nada | Confira se está na conversa **"Você"** e se **respondeu** o vídeo (segurar e Responder). |
| A figurinha cortou uma parte importante | Use `!som ajustar` pra manter o vídeo inteiro. |
| A figurinha chegou sem som | Ela foi encaminhada. Mande pelo teclado de figurinhas. |
| `Conexão caiu, reconectando...` | É normal de vez em quando. Ele reconecta sozinho. |

---

## Atualizar

- **ZIP:** baixe de novo e substitua os arquivos, **mas mantenha a pasta `auth/`** (e a `memes/`, se usar). Depois rode `npm install`.
- **git:** `git pull` e depois `npm install`.

## Desinstalar

1. No celular, desconecte o aparelho em **Aparelhos conectados**.
2. Apague a pasta do figsom.
