// Lista os blocos (chunks) RIFF de um arquivo WebP.
// Uso: node ferramentas/chunks.js figurinha.webp
import fs from 'node:fs'

const buf = fs.readFileSync(process.argv[2])
console.log('cabeçalho:', buf.toString('ascii', 0, 4), buf.toString('ascii', 8, 12), '| tamanho:', buf.length)
let off = 12
const contagem = {}
while (off + 8 <= buf.length) {
  const id = buf.toString('ascii', off, off + 4)
  const size = buf.readUInt32LE(off + 4)
  contagem[id] = (contagem[id] || 0) + 1
  if (id === 'VP8X') console.log(`VP8X  ${1 + buf.readUIntLE(off + 12, 3)}x${1 + buf.readUIntLE(off + 15, 3)}`)
  else if (id !== 'ANMF' || contagem[id] <= 2) console.log(`${id}  ${size} bytes  @${off}`)
  off += 8 + size + (size % 2)
}
console.log('resumo:', contagem)
