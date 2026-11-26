// Ponte segura entre a janela e o processo principal (a página não tem acesso ao Node)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('figsom', {
  estado: () => ipcRenderer.invoke('estado'),
  aceitarAviso: () => ipcRenderer.invoke('aceitar-aviso'),
  conectar: () => ipcRenderer.invoke('conectar'),
  pausar: () => ipcRenderer.invoke('pausar'),
  desconectar: () => ipcRenderer.invoke('desconectar'),
  abrirMemes: () => ipcRenderer.invoke('abrir-memes'),
  config: (mudancas) => ipcRenderer.invoke('config', mudancas),
  abrirLink: (url) => ipcRenderer.invoke('abrir-link', url),
  // aba Memes (o processo principal confere cada argumento)
  listarMemes: () => ipcRenderer.invoke('listar-memes'),
  miniatura: (nome) => ipcRenderer.invoke('miniatura', nome),
  criarEnviar: (pedido) => ipcRenderer.invoke('criar-enviar', pedido),
  baixarLink: (pedido) => ipcRenderer.invoke('baixar-link', pedido),
  aoLog: (cb) => ipcRenderer.on('log', (_e, d) => cb(d)),
  aoEstado: (cb) => ipcRenderer.on('estado', (_e, d) => cb(d)),
  aoMemes: (cb) => ipcRenderer.on('memes', () => cb()),
})
