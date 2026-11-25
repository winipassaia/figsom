## Qual arquivo baixar?

| Sistema | Arquivo | |
|---|---|---|
| **Windows** | `figsom-…-instalador-windows.exe` | **Recomendado.** Instala e cria atalho no menu Iniciar. |
| Windows | `figsom-…-portatil-windows.exe` | Não instala nada: é só abrir. Demora um pouco mais pra abrir. |
| **Linux** | `figsom-…-linux.AppImage` | Dê permissão de execução (`chmod +x`) e abra. |

Não precisa instalar Node.js nem ffmpeg: já vem tudo dentro.

## "O Windows protegeu o computador"

O figsom não tem assinatura digital (o certificado é caro pra um projeto gratuito), por isso o Windows mostra esse aviso na primeira vez. Clique em **Mais informações → Executar assim mesmo**. O código está todo aqui no repositório pra quem quiser conferir.

## Como usar

1. Abra o figsom e leia o aviso inicial.
2. Escaneie o QR no celular: **WhatsApp → ⋮ → Aparelhos conectados → Conectar um aparelho**.
3. Na conversa com você mesmo, mande um vídeo e responda ele com `!som`.
4. Toque na figurinha que chegar e salve. Mande pelo teclado de figurinhas (encaminhar perde o som).

Passo a passo completo: [tutorial](https://github.com/winipassaia/figsom/blob/main/docs/TUTORIAL.md)

> ⚠️ **Projeto não oficial.** O figsom se conecta ao WhatsApp como aparelho vinculado usando um cliente não oficial, o que viola os termos do WhatsApp e **pode levar ao banimento da conta**. Use por sua conta e risco, de preferência com um número secundário.

---

<sub>Os instaladores incluem o [FFmpeg](https://ffmpeg.org) (build LGPL de [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)), distribuído sob a LGPL. O código-fonte do FFmpeg está em https://ffmpeg.org/download.html e a licença vai junto com o app (`resources/ffmpeg/LICENSE-ffmpeg.txt`).</sub>
