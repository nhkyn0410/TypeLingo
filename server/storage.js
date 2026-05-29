import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, sep } from 'node:path'
import fs from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// Chỉ cho phép tên file đơn giản — chặn path traversal (../, dấu /, \, dấu chấm).
const NAME_RE = /^[a-zA-Z0-9_-]+$/

function resolveDataPath(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) return null
  const filePath = resolve(DATA_DIR, `${name}.json`)
  // Phòng thủ chiều sâu: đảm bảo đường dẫn nằm trong DATA_DIR.
  if (!filePath.startsWith(resolve(DATA_DIR) + sep)) return null
  return filePath
}

export function isValidName(name) {
  return resolveDataPath(name) !== null
}

// Đọc file data/<name>.json. Trả về `fallback` nếu file chưa tồn tại.
export async function readData(name, fallback = null) {
  const filePath = resolveDataPath(name)
  if (!filePath) throw new Error('Tên dữ liệu không hợp lệ')
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

// Ghi/đè file data/<name>.json (định dạng JSON 2 dấu cách).
export async function writeData(name, value) {
  const filePath = resolveDataPath(name)
  if (!filePath) throw new Error('Tên dữ liệu không hợp lệ')
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}
