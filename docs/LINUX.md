# Modo terminal no Linux

Guia pra rodar o figsom pelo código-fonte no **Ubuntu/Debian** (e derivados: Mint, Pop!_OS, Zorin...). No fim tem a variação pra Fedora e Arch. O uso no WhatsApp é igual em qualquer sistema: veja a [Parte 3 do tutorial](TUTORIAL.md#parte-3-criar-figurinhas-com-som).

> Só quer usar? Baixe o **AppImage** na página de [Releases](https://github.com/winipassaia/figsom/releases/latest). Ele já vem com tudo e tem janela. Veja o [tutorial](TUTORIAL.md#linux).

> [!WARNING]
> O figsom é **não oficial** e conecta no seu WhatsApp como um aparelho vinculado, o que vai contra os termos do WhatsApp. **O risco de banimento é baixo**: o figsom só age na sua própria conta, na conversa com você mesmo, e nunca manda mensagem pra outras pessoas, que é o que costuma levar a ban. Mas não é zero, então use um número secundário se puder. Leia as [Dicas de segurança](../README.md#dicas-de-segurança).

---

## 1. Instale o Node.js 20+

O `nodejs` do `apt` padrão costuma ser **antigo demais** (o Ubuntu 24.04 traz o 18). Use o repositório oficial do NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Confira:
```bash
node -v   # v22.x.x
```

> Se preferir não usar `sudo`, o [nvm](https://github.com/nvm-sh/nvm) também funciona: `nvm install 22`.

## 2. Instale o ffmpeg e o git

```bash
sudo apt install -y ffmpeg git
```

O ffmpeg dos repositórios do Ubuntu e do Debian já vem com o `libwebp` e o `libopus`, que são os dois de que o figsom precisa.

## 3. Baixe o figsom

```bash
git clone https://github.com/winipassaia/figsom.git
cd figsom
```

## 4. Inicie

```bash
./iniciar.sh
```

O script:
- confere se o Node.js 20+ e o ffmpeg estão instalados;
- roda `npm install --omit=dev` na primeira vez;
- inicia o bot.

> Se aparecer `Permissão negada`, rode `chmod +x iniciar.sh` uma vez, ou use `bash iniciar.sh`.

Prefere fazer na mão? É o mesmo que `npm install --omit=dev` seguido de `npm start`.

## 5. Escaneie o QR

No celular: **WhatsApp → ⋮ → Aparelhos conectados → Conectar um aparelho** e aponte pro QR no terminal.

> Se o QR aparecer quebrado, aumente a janela do terminal ou diminua a fonte (`Ctrl` + `-`).

Quando aparecer `✅ Conectado`, siga pra **[Parte 3: Criar figurinhas com som](TUTORIAL.md#parte-3-criar-figurinhas-com-som)**.

Pra desligar, use `Ctrl + C`. Da próxima vez, é só `./iniciar.sh`, sem QR.

---

## Outras distros

| Distro | Node.js + ffmpeg |
|---|---|
| **Fedora** | `sudo dnf install nodejs ffmpeg-free git` |
| **Arch / Manjaro** | `sudo pacman -S nodejs npm ffmpeg git` |
| **openSUSE** | `sudo zypper install nodejs22 ffmpeg git` |

Depois siga do [passo 3](#3-baixe-o-figsom) em diante. Confira sempre se `node -v` mostra **20 ou mais**.

## Problemas comuns no Linux

| Problema | Solução |
|---|---|
| `❌ Seu Node.js é a versão 18` | Você instalou o Node pelo `apt` padrão. Volte ao [passo 1](#1-instale-o-nodejs-20). |
| `⚠ Seu ffmpeg não tem libwebp` | Seu ffmpeg veio sem o libwebp (pode acontecer com builds mínimos ou Snap). Instale pelo gerenciador da distro. |
| `bash: ./iniciar.sh: Permissão negada` | `chmod +x iniciar.sh` |
| `EACCES` no `npm install` | Não use `sudo npm install`. Confira se a pasta é do seu usuário: `sudo chown -R $USER .` |

Pra baixar do X e do TikTok (`!criar <link>`, `!salvar`), ponha `baixarLinks: true` no topo do `index.js`: veja [Configuração](TERMINAL.md#configuração).

Os outros problemas (QR, `!criar` não responde, figurinha sem som, links) estão na [tabela do tutorial](TUTORIAL.md#problemas-comuns).
