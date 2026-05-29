import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs'
import { readData, writeData, isValidName } from './storage.js'
import { translateDocument } from './translate.js'
import { listProviders, analyzeTranslation } from './providers/index.js'
import { getPublicConfig, updatePublicConfig } from './config.js'

// Nạp .env (Node >= 20.6 hỗ trợ sẵn). API key chỉ sống ở backend.
try {
  process.loadEnvFile()
} catch {
  // Không có .env cũng không sao — chỉ tính năng dịch AI sẽ báo thiếu key.
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

const PORT = process.env.PORT || 8000
const HOST = '127.0.0.1'

const app = express()
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

// Đọc một file dữ liệu JSON trong data/ (trả [] nếu chưa có).
app.get('/api/data/:name', async (req, res) => {
  const { name } = req.params
  if (!isValidName(name)) {
    return res.status(400).json({ error: 'Tên dữ liệu không hợp lệ' })
  }
  try {
    res.json(await readData(name, []))
  } catch {
    res.status(500).json({ error: 'Không đọc được dữ liệu' })
  }
})

// Ghi/đè một file dữ liệu JSON trong data/.
app.put('/api/data/:name', async (req, res) => {
  const { name } = req.params
  if (!isValidName(name)) {
    return res.status(400).json({ error: 'Tên dữ liệu không hợp lệ' })
  }
  try {
    await writeData(name, req.body)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Không ghi được dữ liệu' })
  }
})

// Liệt kê nhà cung cấp/model đang cấu hình (KHÔNG kèm API key).
app.get('/api/providers', (req, res) => {
  res.json({ providers: listProviders() })
})

// Đọc cấu hình AI công khai. Không trả API key thô.
app.get('/api/config', (req, res) => {
  res.json(getPublicConfig())
})

// Ghi cấu hình AI vào .env local. API key chỉ đi từ trình duyệt tới backend local khi bấm lưu.
app.put('/api/config', async (req, res) => {
  try {
    res.json(await updatePublicConfig(req.body || {}))
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Không lưu được cấu hình.' })
  }
})

// Dịch tài liệu (txt/md/json) → mảng cặp { en, vi } để tạo bài luyện.
app.post('/api/translate', async (req, res) => {
  const { content, type, direction, provider, model } = req.body || {}
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Thiếu nội dung tài liệu để dịch.' })
  }
  try {
    const result = await translateDocument({ content, type, direction, provider, model })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Dịch thất bại.' })
  }
})

// Phân tích lỗi một câu dịch của học viên → { score, comment, errors }.
app.post('/api/analyze', async (req, res) => {
  const { source, reference, user, direction, provider, model } = req.body || {}
  if (typeof user !== 'string' || !user.trim()) {
    return res.status(400).json({ error: 'Thiếu bản dịch của người dùng để phân tích.' })
  }
  const [sourceLang, targetLang] = String(direction || 'en-vi').split('-')
  if (!sourceLang || !targetLang) {
    return res.status(400).json({ error: 'Chiều dịch không hợp lệ.' })
  }
  try {
    const result = await analyzeTranslation({ source, reference, user, sourceLang, targetLang, provider, model })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Phân tích thất bại.' })
  }
})

// Phục vụ frontend đã build (nếu đã chạy `npm run build`).
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  // SPA fallback: mọi GET không phải /api trả về index.html.
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(join(DIST, 'index.html'))
    }
    next()
  })
}

app.listen(PORT, HOST, () => {
  console.log(`Backend chạy tại http://${HOST}:${PORT}`)
})
