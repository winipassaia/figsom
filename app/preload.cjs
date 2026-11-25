// Ponte segura entre a janela e o processo principal (a página não tem acesso ao Node)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('figsom', {
  estado: () => ipcRenderer.invoke('estado'),
  aceitarAviso: () => ipcRenderer.invoke('aceitar-aviso'),
  conectar: () => ipcRenderer.invoke('conectar'),
  desconectar: () => ipcRenderer.invoke('desconectar'),
  abrirMemes: () => ipcRenderer.invoke('abrir-memes'),
  config: (mudancas) => ipcRenderer.invoke('config', mudancas),
  abrirLink: (url) => ipcRenderer.invoke('abrir-link', url),
  aoLog: (cb) => ipcRenderer.on('log', (_e, d) => cb(d)),
  aoEstado: (cb) => ipcRenderer.on('estado', (_e, d) => cb(d)),
})
