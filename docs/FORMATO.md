# Formato das figurinhas com som (engenharia reversa)

Documentação do formato observado em novembro de 2026: WhatsApp Android 2.26.4x, liberação gradual a partir de 24/11/2026. Nada aqui é oficial. Pode mudar a qualquer momento.

## Resumo

Uma figurinha com som **não é um arquivo novo**. São **duas mídias comuns** dentro de uma mesma mensagem:

- um **WebP animado** (a figurinha de sempre);
- um **áudio OGG/Opus**, com a mesma estrutura de uma mensagem de voz.

O que muda é **onde** elas ficam na mensagem protobuf.

## Estrutura

```
Message
├─ 35: messageContextInfo
│     └─ 3: messageSecret (32 bytes aleatórios)
└─ 134: FutureProofMessage                  ← campo NOVO no Message
      └─ 1: Message
            └─ 26: StickerMessage            ← stickerMessage normal
                  ├─ 1..23: campos de sempre (url, mediaKey, mimetype "image/webp", ...)
                  └─ 26: AudioMessage        ← campo NOVO no StickerMessage
                        ├─ 1: url
                        ├─ 2: mimetype       "audio/ogg; codecs=opus"
                        ├─ 3: fileSha256
                        ├─ 4: fileLength
                        ├─ 5: seconds
                        ├─ 7: mediaKey
                        ├─ 8: fileEncSha256
                        ├─ 9: directPath
                        └─ 10: mediaKeyTimestamp
```

- O campo **134** do `Message` tem o mesmo formato de outros embrulhos `FutureProofMessage` já existentes (por exemplo `groupStatusMessageV2`): um único campo `1` com um `Message` dentro.
- O campo **26** do `StickerMessage` bate exatamente com o `Message.AudioMessage` (mesmos números e tipos).
- Quando a mensagem é enviada **por outro aparelho da mesma conta**, ela chega embrulhada em `deviceSentMessage` (campo 31 → `2: message`), como qualquer outra.

## Mídias

| | Figurinha | Áudio |
|---|---|---|
| Tipo de upload e chave (HKDF) | `sticker` / "WhatsApp Image Keys" | `audio` / "WhatsApp Audio Keys" |
| Formato | WebP animado (`VP8X` + `ANIM` + `ANMF` + `EXIF`), 512×512 | OGG/Opus |
| Observado | 210 KB a ~950 KB (acima do limite antigo de 500 KB) | 4 a 10 s, ~20 a 70 KB |

O WebP **não carrega o áudio**: não há blocos RIFF extras, só `VP8X`, `ANIM`, os quadros `ANMF` e o `EXIF` de metadados.

## Comportamentos observados

- **Encaminhar perde o áudio.** Uma figurinha com som encaminhada chega como `stickerMessage` comum no topo da mensagem, sem o campo 134 e sem o áudio.
- **Salvar mantém o áudio.** Contas que ainda não podem *criar* conseguem receber, salvar e reenviar pelo teclado.
- O som não toca sozinho. Na conversa, a figurinha aparece com um ícone de áudio.

## Por que o Baileys não funciona sem ajuda

O Baileys (7.0.0-rc14) gera o código protobuf a partir de um `.proto` que ainda não tem os campos 134 e 26:

- **Ao receber:** o protobufjs descarta campos desconhecidos. A mensagem decodificada fica vazia (`{}`), só com `messageContextInfo`.
- **Ao enviar:** o `encode` só escreve campos conhecidos. Um campo extra no objeto é ignorado silenciosamente.

## Como o figsom resolve

### Receber (`src/raw.js`, modo `capturar`)

Envolve `proto.Message.decode`: pega os bytes crus de cada mensagem de topo antes de decodificar e guarda os das que o Baileys deixa vazias ou que têm figurinha. Depois procura o caminho `134 → 1 → 26 → 26` direto nos bytes e decodifica os pedaços com `StickerMessage.decode` e `AudioMessage.decode`.

### Enviar (`src/enviar.js`)

1. Faz o upload do WebP (`prepareWAMessageMedia({ sticker })`) e do OGG (`prepareWAMessageMedia({ audio, seconds })`).
2. Monta um objeto de mensagem cujo `stickerMessage` fica **no protótipo**. Assim o Baileys enxerga a mensagem como sticker (`mediatype="sticker"`), mas o `encode` não o escreve no topo, porque só codifica propriedades próprias.
3. Envolve `proto.Message.encode`: se a mensagem tiver o marcador, acrescenta à mão o campo 134 com `StickerMessage` + campo 26 (`AudioMessage`).
4. Envia com `sock.relayMessage`. O gancho também funciona dentro do `deviceSentMessage` que vai pros seus outros aparelhos.
5. Guarda o **próprio objeto** enviado (não uma cópia) pro `getMessage`: se algum aparelho pedir reenvio, o Baileys reaproveita o objeto e o gancho escreve o campo 134 de novo. Qualquer cópia (`fromObject`, JSON, `{...msg}`) perde o formato.

O truque depende de detalhes internos do Baileys, por isso a versão fica fixa no `package.json`. Ao iniciar, o figsom confere o formato com um autoteste (`conferirFormato`) e desliga o envio se ele não sair certo. O `npm test` faz a mesma conferência, e o workflow de release roda os testes antes de empacotar.

## Como investigar você mesmo

1. No modo terminal, ponha `capturar: true` no `index.js`. Não precisa mexer no `soConversaComigo`: a captura vale pra qualquer conversa, e deixar ele `true` evita que um `!criar` digitado num grupo dispare.
2. Receba uma figurinha com som (enviada direto, não encaminhada).
3. Veja `dumps/raw/*.txt`: a árvore de campos sem nomes, no estilo de `protoc --decode_raw`.
4. Veja `dumps/figsom/*/`: o `fig.webp` e o `som.ogg` já descriptografados.

> [!CAUTION]
> Os arquivos de `dumps/` contêm URLs e chaves de mídia reais, e figurinhas que **outras pessoas** te mandaram. Não publique, apague quando terminar e desligue o `capturar` depois.
