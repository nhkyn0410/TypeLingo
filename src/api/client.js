// Lớp dữ liệu phía client.
//
// Mô hình triển khai: web công khai, mỗi người TỰ nhập API key của mình (BYOK).
// - Dữ liệu học (bài dịch, từ vựng, thống kê) lưu trong localStorage của TỪNG trình duyệt.
// - API key + lựa chọn model cũng lưu trong localStorage; chỉ rời máy người dùng khi gọi AI.
// - Backend chỉ là proxy không lưu gì: nhận apiKey theo từng request để gọi nhà cung cấp.
//
// Giữ nguyên chữ ký bất đồng bộ (Promise) của getData/putData… để các tính năng không phải sửa.
import { SEED } from '../lib/seed'

const PREFIX = 'le:'
const dataKey = (name) => `${PREFIX}data:${name}`
const SETTINGS_KEY = `${PREFIX}settings`
const SEEDED_KEY = `${PREFIX}seeded`

// Danh mục nhà cung cấp AI hỗ trợ (tĩnh, phía client).
// baseURL do BACKEND tự suy ra theo tên provider — KHÔNG gửi từ client (chống SSRF).
export const PROVIDER_CATALOG = [
  { name: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat' },
  { name: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
  { name: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-3-5-haiku-latest' },
  { name: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-1.5-flash' },
]
const DEFAULT_PROVIDER = 'deepseek'

function hasLS() {
  return typeof localStorage !== 'undefined'
}

function readLS(key, fallback) {
  if (!hasLS()) return fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeLS(key, value) {
  if (!hasLS()) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Hết dung lượng hoặc chế độ riêng tư chặn ghi — bỏ qua, state vẫn giữ trong phiên.
  }
}

// Gieo dữ liệu mẫu lần đầu mở app (chỉ một lần, tôn trọng nếu người dùng đã xóa).
function seedIfNeeded() {
  if (!hasLS() || readLS(SEEDED_KEY, false)) return
  for (const [name, value] of Object.entries(SEED)) {
    if (localStorage.getItem(dataKey(name)) == null) writeLS(dataKey(name), value)
  }
  writeLS(SEEDED_KEY, true)
}

// ---- "File" dữ liệu (nay nằm trong localStorage) ----

export function getData(name) {
  seedIfNeeded()
  return Promise.resolve(readLS(dataKey(name), []))
}

export function putData(name, value) {
  writeLS(dataKey(name), value)
  return Promise.resolve({ ok: true })
}

// ---- Cấu hình AI (lưu trong trình duyệt) ----
// settings shape: { defaultProvider, providers: { [name]: { apiKey, model } } }

function readSettings() {
  const s = readLS(SETTINGS_KEY, {})
  return {
    defaultProvider: s?.defaultProvider || DEFAULT_PROVIDER,
    providers: s?.providers && typeof s.providers === 'object' ? s.providers : {},
  }
}

// Thông tin hiển thị cho màn CẤU HÌNH — KHÔNG trả apiKey thô (chỉ cờ configured).
export function getConfig() {
  const s = readSettings()
  return Promise.resolve({
    defaultProvider: s.defaultProvider,
    providers: PROVIDER_CATALOG.map((p) => {
      const saved = s.providers[p.name] || {}
      return {
        name: p.name,
        label: p.label,
        defaultModel: p.defaultModel,
        model: (saved.model || '').trim(),
        configured: Boolean((saved.apiKey || '').trim()),
        isDefault: p.name === s.defaultProvider,
      }
    }),
  })
}

// payload: { defaultProvider, providers: { name: { apiKey, model } } }
// apiKey để trống = giữ key cũ (không ghi đè).
export function putConfig(payload = {}) {
  const s = readSettings()
  const next = { defaultProvider: s.defaultProvider, providers: { ...s.providers } }

  const dp = String(payload.defaultProvider || '').toLowerCase()
  if (PROVIDER_CATALOG.some((p) => p.name === dp)) next.defaultProvider = dp

  const incoming = payload.providers && typeof payload.providers === 'object' ? payload.providers : {}
  for (const p of PROVIDER_CATALOG) {
    const values = incoming[p.name]
    if (!values || typeof values !== 'object') continue
    const cur = { ...(next.providers[p.name] || {}) }
    if (Object.prototype.hasOwnProperty.call(values, 'apiKey')) {
      const k = (values.apiKey || '').trim()
      if (k) cur.apiKey = k // để trống = giữ nguyên key đã lưu
    }
    if (Object.prototype.hasOwnProperty.call(values, 'model')) {
      cur.model = (values.model || '').trim()
    }
    next.providers[p.name] = cur
  }

  writeLS(SETTINGS_KEY, next)
  return getConfig()
}

// Danh sách nhà cung cấp cho các màn AI (suy từ cấu hình đã lưu).
export function getProviders() {
  const s = readSettings()
  return Promise.resolve({
    providers: PROVIDER_CATALOG.map((p) => {
      const saved = s.providers[p.name] || {}
      const model = (saved.model || '').trim() || p.defaultModel
      return {
        name: p.name,
        label: p.label,
        model,
        configured: Boolean((saved.apiKey || '').trim()),
        isDefault: p.name === s.defaultProvider,
      }
    }),
  })
}

// Lấy key + model đã lưu cho một nhà cung cấp (dùng nội bộ khi gọi AI).
function credsFor(provider) {
  const s = readSettings()
  const name = (provider || s.defaultProvider || DEFAULT_PROVIDER).toLowerCase()
  const meta = PROVIDER_CATALOG.find((p) => p.name === name)
  const saved = s.providers[name] || {}
  const apiKey = (saved.apiKey || '').trim()
  const model = (saved.model || '').trim() || (meta?.defaultModel || '')
  return { name, apiKey, model }
}

// ---- Gọi backend (chỉ cho tác vụ AI; server KHÔNG lưu gì) ----

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text
    try {
      const parsed = JSON.parse(text)
      msg = parsed?.error || parsed?.message || text
    } catch {
      msg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    throw new Error(`API ${path} lỗi ${res.status}${msg ? `: ${msg}` : ''}`)
  }
  return res.json()
}

export function getHealth() {
  return request('/health')
}

// Dịch tài liệu (txt/md/json) → mảng cặp { en, vi }. Đính kèm API key của người dùng.
export function translateDocument({ content, type, direction, provider }) {
  const { name, apiKey, model } = credsFor(provider)
  if (!apiKey) {
    return Promise.reject(new Error(`Chưa có API key cho "${name}". Mở tab CẤU HÌNH để nhập key của bạn.`))
  }
  return request('/translate', {
    method: 'POST',
    body: JSON.stringify({ content, type, direction, provider: name, model, apiKey }),
  })
}

// Phân tích lỗi một câu dịch → { score, comment, errors }. Hỗ trợ AbortSignal.
export function analyzeSentence({ source, reference, user, direction, provider, signal }) {
  const { name, apiKey, model } = credsFor(provider)
  if (!apiKey) {
    return Promise.reject(new Error(`Chưa có API key cho "${name}". Mở tab CẤU HÌNH để nhập key của bạn.`))
  }
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({ source, reference, user, direction, provider: name, model, apiKey }),
    signal,
  })
}

// Sinh nghĩa + ví dụ riêng cho danh sách từ tiếng Anh → { entries: [{ term, meaning, example, exampleVi }] }.
export function defineVocabulary({ words, provider, signal }) {
  const { name, apiKey, model } = credsFor(provider)
  if (!apiKey) {
    return Promise.reject(new Error(`Chưa có API key cho "${name}". Mở tab CẤU HÌNH để nhập key của bạn.`))
  }
  return request('/vocab', {
    method: 'POST',
    body: JSON.stringify({ words, provider: name, model, apiKey }),
    signal,
  })
}
