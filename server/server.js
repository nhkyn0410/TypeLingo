import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs'
import { translateDocument } from './translate.js'
import { analyzeTranslation, vocabularyEntries } from './providers/index.js'

// Nạp .env (Node >= 20.6 hỗ trợ sẵn). Khi deploy công khai (BYOK) thì .env có thể trống:
// API key đi kèm từng request từ trình duyệt người dùng, backend KHÔNG lưu lại.
try {
  process.loadEnvFile()
} catch {
  // Không có .env cũng không sao — mỗi người dùng tự nhập API key trong giao diện.
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

const PORT = process.env.PORT || 8000
// Local mặc định bind 127.0.0.1; khi deploy đặt HOST=0.0.0.0 để mở ra ngoài.
const HOST = process.env.HOST || '127.0.0.1'

const app = express()
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

// Backend chỉ là PROXY không lưu trạng thái:
// - Dữ liệu học (bài, từ vựng, tiến độ) nằm trong trình duyệt mỗi người (localStorage).
// - API key đi kèm từng request từ trình duyệt, dùng xong là thôi — KHÔNG ghi log/lưu file.

// Dịch tài liệu (txt/md/json) → mảng cặp { en, vi } để tạo bài luyện.
app.post('/api/translate', async (req, res) => {
  const { content, type, direction, provider, model, apiKey } = req.body || {}
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Thiếu nội dung tài liệu để dịch.' })
  }
  try {
    const result = await translateDocument({ content, type, direction, provider, model, apiKey })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Dịch thất bại.' })
  }
})

// Phân tích lỗi một câu dịch của học viên → { score, comment, errors }.
app.post('/api/analyze', async (req, res) => {
  const { source, reference, user, direction, provider, model, apiKey } = req.body || {}
  if (typeof user !== 'string' || !user.trim()) {
    return res.status(400).json({ error: 'Thiếu bản dịch của người dùng để phân tích.' })
  }
  const [sourceLang, targetLang] = String(direction || 'en-vi').split('-')
  if (!sourceLang || !targetLang) {
    return res.status(400).json({ error: 'Chiều dịch không hợp lệ.' })
  }
  try {
    const result = await analyzeTranslation({ source, reference, user, sourceLang, targetLang, provider, model, apiKey })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Phân tích thất bại.' })
  }
})

// Sinh nghĩa + ví dụ riêng cho danh sách từ tiếng Anh → { entries: [{ term, meaning, example, exampleVi }] }.
app.post('/api/vocab', async (req, res) => {
  const { words, provider, model, apiKey } = req.body || {}
  const list = Array.isArray(words)
    ? words.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 100) // chặn lô quá lớn
    : []
  if (!list.length) {
    return res.status(400).json({ error: 'Thiếu danh sách từ để tạo nghĩa/ví dụ.' })
  }
  try {
    const entries = await vocabularyEntries({ words: list, provider, model, apiKey })
    res.json({ entries })
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Tạo từ vựng thất bại.' })
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
