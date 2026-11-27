## Novidades da 1.1.1

- **Corrigido: o figsom parava de responder depois de algumas horas.** Ele continuava "Conectado", mas o `!criar` sumia sem resposta, e só um QR novo resolvia. A causa era o figsom recusar toda a sincronização inicial que o WhatsApp manda pra aparelhos vinculados. Agora ele aceita só a parte mínima, de contatos e endereços, e continua recusando as conversas. Nada disso é guardado nem mostrado.
- **Importante pra quem já usava a 1.1.0:** depois de atualizar, clique em **Desconectar conta** e conecte de novo pelo QR, **uma vez só**. A conexão antiga foi feita sem essa sincronização e pode continuar parando. O figsom mostra um aviso na Atividade enquanto isso não for feito.

## Novidades da 1.1

- **Baixar do X e do TikTok:** `!criar <link>` (ou responder o link com `!criar`) cria a figurinha direto de um post, e `!salvar <link> nome` guarda o vídeo na pasta de memes. O componente de download (yt-dlp) **não vem no instalador**: ele só é baixado da página oficial, com o SHA-256 conferido, quando você liga a chave **Baixar de links (X e TikTok)** na aba Memes. YouTube não é suportado.
- **Aba Memes no app:** baixe vídeos por link e veja a biblioteca da pasta de memes com miniaturas. O botão **Criar e enviar** manda a figurinha pra sua conversa "Você", com as opções Ajustar e Trecho.
- **Comandos novos:** `!criar` (o antigo `!som`, que continua funcionando), `!salvar`, `!memes` e `!ajuda`, que responde no WhatsApp com a lista de comandos.
- **Reações no lugar de apagar:** o figsom reage ao comando com ⏳ e depois ✅ (ou ❌ se der erro). A mensagem do comando não é mais apagada; quem quiser pode ligar **Apagar o comando depois de enviar** no rodapé.
- Toda figurinha leva nos dados "Criado pelo APP figsom" e "github @winipassaia" (aparece quando alguém toca nela).
- Guia de como achar a conversa "Você" no README e no tutorial.

> Baixar vídeos pode violar os termos de uso do X e do TikTok e os direitos autorais de quem fez o vídeo. Use só pra uso pessoal.

## Qual arquivo baixar?

| Sistema | Arquivo | |
|---|---|---|
| **Windows** | `figsom-…-instalador-windows.exe` | **Recomendado.** Instala e cria atalho no menu Iniciar. |
| Windows | `figsom-…-portatil-windows.exe` | Não instala nada: é só abrir. Demora um pouco mais pra abrir. |
| **Ubuntu / Debian** | `figsom-…-linux.deb` | **Recomendado.** Instale com `sudo apt install ./figsom-*-linux.deb`. |
| Outras distros Linux | `figsom-…-linux.AppImage` | Dê permissão de execução (`chmod +x`) e abra. |

Não precisa instalar Node.js nem ffmpeg: já vem tudo dentro. As somas SHA-256 de cada arquivo estão em `SHA256SUMS.txt`.

## "O Windows protegeu o computador"

O figsom não tem assinatura digital (o certificado é caro pra um projeto gratuito), por isso o Windows mostra esse aviso na primeira vez. Clique em **Mais informações → Executar assim mesmo**. O código está todo aqui no repositório pra quem quiser conferir.

## Como usar

1. Abra o figsom e leia o aviso inicial.
2. Escaneie o QR no celular: **WhatsApp → ⋮ → Aparelhos conectados → Conectar um aparelho**.
3. Na conversa com você mesmo (Nova conversa → o seu contato, "(Você)"), mande um vídeo e responda ele com `!criar`. Mande `!ajuda` pra ver todos os comandos.
4. Toque na figurinha que chegar e salve. Mande pelo teclado de figurinhas (encaminhar perde o som).

Pra dar uma pausa: clique em **Pausar** (ou feche a janela). A conta continua conectada e pra voltar não precisa de QR.

Pra parar de usar: clique em **Desconectar conta** antes de desinstalar. Desinstalar sozinho não tira o figsom da lista de aparelhos conectados do celular.

Passo a passo completo: [tutorial](https://github.com/winipassaia/figsom/blob/main/docs/TUTORIAL.md)

> ⚠️ **Projeto não oficial.** O figsom se conecta ao WhatsApp como aparelho vinculado usando um cliente não oficial, o que vai contra os termos do WhatsApp. **O risco de banimento é baixo**: o figsom só age na sua própria conta, na conversa com você mesmo, e nunca manda mensagem pra outras pessoas, que é o que costuma levar a ban. Mas não é zero, então use um número secundário se puder.

---

<sub>Os instaladores incluem o [FFmpeg](https://ffmpeg.org), distribuído sob a LGPL. A licença vai junto com o app (`resources/ffmpeg/LICENSE-ffmpeg.txt`).</sub>
