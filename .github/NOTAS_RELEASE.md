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
3. Na conversa com você mesmo, mande um vídeo e responda ele com `!som`.
4. Toque na figurinha que chegar e salve. Mande pelo teclado de figurinhas (encaminhar perde o som).

Pra dar uma pausa: clique em **Pausar** (ou feche a janela). A conta continua conectada e pra voltar não precisa de QR.

Pra parar de usar: clique em **Desconectar conta** antes de desinstalar. Desinstalar sozinho não tira o figsom da lista de aparelhos conectados do celular.

Passo a passo completo: [tutorial](https://github.com/winipassaia/figsom/blob/main/docs/TUTORIAL.md)

> ⚠️ **Projeto não oficial.** O figsom se conecta ao WhatsApp como aparelho vinculado usando um cliente não oficial. Isso viola os termos do WhatsApp e **pode levar ao banimento da conta**, mesmo em uso pessoal. Use por sua conta e risco, de preferência com um número secundário.

---

<sub>Os instaladores incluem o [FFmpeg](https://ffmpeg.org), distribuído sob a LGPL. A licença vai junto com o app (`resources/ffmpeg/LICENSE-ffmpeg.txt`).</sub>
