# figsom 🔊

Crie **figurinhas com som** no WhatsApp a partir de qualquer vídeo, mesmo que o recurso oficial ainda não tenha chegado pra sua conta.

Responda um vídeo com `!som` e a figurinha volta com o áudio do próprio vídeo. Depois é só salvar e usar pelo teclado de figurinhas.

> [!WARNING]
> **Projeto não oficial, use por sua conta e risco.**
> O figsom se conecta ao WhatsApp como um aparelho vinculado usando o [Baileys](https://github.com/WhiskeySockets/Baileys), um cliente **não oficial**. Isso viola os Termos de Serviço do WhatsApp e **pode levar ao banimento da conta**. O uso pessoal e com pouco volume tem risco baixo, mas **não é zero**. Se possível, use um número secundário. Não use pra spam nem pra enviar em massa.
> Este projeto não tem nenhuma ligação com o WhatsApp ou a Meta.

---

## Como funciona

1. O bot conecta no seu WhatsApp como um aparelho vinculado, igual ao WhatsApp Web.
2. Na conversa com você mesmo (**"Você"**), você manda um vídeo e responde com `!som`.
3. O bot converte o vídeo em **WebP animado 512×512** e o áudio em **OGG/Opus** (até 10 s) usando o ffmpeg.
4. O bot envia a figurinha com som nessa mesma conversa.
5. Você toca nela, **salva nas figurinhas** e manda pra quem quiser pelo teclado.

> [!NOTE]
> **Encaminhar a figurinha perde o áudio.** Use sempre a figurinha salva, pelo teclado.

Por padrão o bot só aceita comandos na conversa "Você", não guarda mensagens de ninguém e não baixa histórico.

## Requisitos

- [Node.js](https://nodejs.org) **20+**
- [ffmpeg](https://ffmpeg.org) no PATH
  - Windows: `winget install ffmpeg` (depois, reabra o terminal)
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - macOS: `brew install ffmpeg`

## Instalação

```bash
git clone https://github.com/<usuario>/figsom.git
cd figsom
npm install
npm start
```

No celular, vá em **WhatsApp → Aparelhos conectados → Conectar aparelho** e escaneie o QR que aparece no terminal. A sessão fica salva na pasta `auth/`, então nas próximas vezes não precisa escanear de novo.

> [!CAUTION]
> A pasta `auth/` dá **acesso total** à sua conta. Nunca compartilhe nem suba ela pro GitHub. O `.gitignore` já ignora essa pasta.

## Comandos

Todos funcionam só na conversa **"Você"**:

| Comando | O que faz |
|---|---|
| `!som` (respondendo um vídeo) | Transforma o vídeo em figurinha com o áudio dele |
| `!som nome` | Usa os arquivos da pasta `memes/` (veja abaixo) |
| `!som lista` | Lista os memes da pasta `memes/` |

### Pasta `memes/`

Para `!som nome`, o bot procura, nesta ordem:

- `memes/nome.webp`: a figurinha pronta. Sem ela, usa um vídeo (`nome.mp4`, `.mov`, `.webm`, `.mkv`, `.gif`, `.avi`).
- `memes/nome.mp3` (ou `.ogg`, `.opus`, `.m4a`, `.wav`, `.aac`, `.flac`): um áudio separado. Sem ele, usa o áudio do vídeo.

Exemplos: `memes/tome.mp4` sozinho já basta. `memes/gato.gif` + `memes/gato.mp3` coloca outro som no GIF.

## Configuração

No topo do `index.js`:

| Opção | Padrão | Descrição |
|---|---|---|
| `MEMES_DIR` | `memes` | Pasta dos memes |
| `APAGAR_COMANDO` | `true` | Apaga a mensagem `!som` depois de enviar |
| `SO_CONVERSA_COMIGO` | `true` | Só aceita comandos na conversa "Você" |
| `CAPTURAR` | `false` | Modo estudo: salva figurinhas com som **recebidas** em `dumps/` (WebP + OGG + bytes crus) |

## Dicas de segurança

- Ligue o bot só quando for criar figurinhas e desligue depois (`Ctrl+C`).
- Mantenha o backup das conversas em dia.
- Se aparecer algum aviso de "app não oficial", pare de usar.
- Não transforme isso num bot público no seu número principal.

## Por baixo dos panos

O WhatsApp lançou as figurinhas com som em novembro de 2026, mas o Baileys ainda não conhece o formato. Ao receber uma dessas, ele mostra uma mensagem vazia. Ao enviar, apaga os campos que não conhece.

O figsom descobriu o formato capturando os bytes crus das mensagens e resolve os dois lados com ganchos no protobuf. Detalhes em **[docs/FORMATO.md](docs/FORMATO.md)**.

```
Message
└─ 134: FutureProofMessage        (campo novo)
   └─ 1: Message
      └─ 26: StickerMessage       → WebP animado
         └─ 26: AudioMessage      (campo novo) → OGG/Opus
```

## Roadmap

- [ ] `!som quadrado`: cortar o centro do vídeo em vez de encaixar com transparência
- [ ] `!som 2-6`: usar só um trecho do vídeo
- [ ] Áudio por link (ex.: MyInstants)
- [ ] Imagem/GIF + áudio respondendo mensagens
- [ ] Editor web local com prévia
- [ ] Imagem Docker

## Créditos

- [Baileys](https://github.com/WhiskeySockets/Baileys), cliente WhatsApp Web em TypeScript
- [ffmpeg](https://ffmpeg.org)

## Licença

[MIT](LICENSE)
