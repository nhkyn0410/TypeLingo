// Cấu hình nhà cung cấp dịch — đọc/ghi từ biến môi trường (.env).
// API key CHỈ nằm ở backend; KHÔNG bao giờ trả ra frontend.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '..', '.env')

// Mỗi nhà cung cấp khai báo: adapter dùng để gọi, tên biến env chứa key/baseURL,
// cùng base URL & model mặc định khi để trống.
const PROVIDERS = {
  anthropic: {
    adapter: 'anthropic',
    keyEnv: 'ANTHROPIC_API_KEY',
    baseURLEnv: 'ANTHROPIC_BASE_URL',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultBaseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-haiku-latest',
  },
  openai: {
    adapter: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    baseURLEnv: 'OPENAI_BASE_URL',
    modelEnv: 'OPENAI_MODEL',
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  gemini: {
    adapter: 'gemini',
    keyEnv: 'GEMINI_API_KEY',
    baseURLEnv: 'GEMINI_BASE_URL',
    modelEnv: 'GEMINI_MODEL',
    defaultBaseURL: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-1.5-flash',
  },
  deepseek: {
    // DeepSeek tương thích chuẩn OpenAI → dùng chung adapter openai.
    adapter: 'openai',
    keyEnv: 'DEEPSEEK_API_KEY',
    baseURLEnv: 'DEEPSEEK_BASE_URL',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultBaseURL: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
  },
}

const env = (k) => (process.env[k] ?? '').trim()

function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function encodeEnvValue(value) {
  const v = cleanValue(value)
  if (!v) return ''
  if (/\s|#|"/.test(v)) return JSON.stringify(v)
  return v
}

export function defaultProviderName() {
  const name = env('TRANSLATE_PROVIDER').toLowerCase()
  return PROVIDERS[name] ? name : 'deepseek'
}

// Cấu hình đầy đủ (GỒM apiKey) — chỉ dùng nội bộ backend, không trả ra ngoài.
export function getProviderConfig(name) {
  const key = (name || defaultProviderName()).toLowerCase()
  const def = PROVIDERS[key]
  if (!def) return null
  const apiKey = env(def.keyEnv)
  const baseURL = env(def.baseURLEnv) || def.defaultBaseURL
  // TRANSLATE_MODEL (nếu đặt) chỉ áp dụng cho nhà cung cấp mặc định,
  // tránh gửi nhầm tên model của provider này sang provider khác.
  const overrideModel = env('TRANSLATE_MODEL')
  const providerModel = env(def.modelEnv)
  const model = providerModel || (key === defaultProviderName() && overrideModel) || def.defaultModel
  return { name: key, adapter: def.adapter, apiKey, baseURL, model, configured: Boolean(apiKey) }
}

// Thông tin CÔNG KHAI để frontend hiển thị — KHÔNG kèm apiKey.
export function listProviders() {
  const def = defaultProviderName()
  return Object.keys(PROVIDERS).map((key) => {
    const cfg = getProviderConfig(key)
    return { name: key, model: cfg.model, baseURL: cfg.baseURL, configured: cfg.configured, isDefault: key === def }
  })
}

export function getPublicConfig() {
  const def = defaultProviderName()
  return {
    port: env('PORT') || '8000',
    defaultProvider: def,
    providers: Object.keys(PROVIDERS).map((key) => {
      const cfg = getProviderConfig(key)
      const meta = PROVIDERS[key]
      return {
        name: key,
        keyEnv: meta.keyEnv,
        baseURLEnv: meta.baseURLEnv,
        modelEnv: meta.modelEnv,
        baseURL: cfg.baseURL,
        model: cfg.model,
        defaultBaseURL: meta.defaultBaseURL,
        defaultModel: meta.defaultModel,
        configured: cfg.configured,
        isDefault: key === def,
      }
    }),
  }
}

function setProcessEnv(updates) {
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = cleanValue(value)
  }
}

async function readEnvLines() {
  try {
    return (await fs.readFile(ENV_PATH, 'utf8')).split(/\r?\n/)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

async function writeEnvUpdates(updates) {
  const lines = await readEnvLines()
  const pending = new Map(Object.entries(updates))
  const next = lines.map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/)
    if (!match || !pending.has(match[1])) return line
    const key = match[1]
    const value = pending.get(key)
    pending.delete(key)
    return `${key}=${encodeEnvValue(value)}`
  })

  if (pending.size) {
    if (next.length && next[next.length - 1].trim()) next.push('')
    for (const [key, value] of pending) next.push(`${key}=${encodeEnvValue(value)}`)
  }

  await fs.writeFile(ENV_PATH, `${next.join('\n').replace(/\n*$/, '')}\n`, 'utf8')
}

export async function updatePublicConfig(payload = {}) {
  const updates = {}
  const provider = cleanValue(payload.defaultProvider).toLowerCase()
  if (PROVIDERS[provider]) updates.TRANSLATE_PROVIDER = provider

  const providerConfigs = payload.providers && typeof payload.providers === 'object' ? payload.providers : {}
  for (const [name, values] of Object.entries(providerConfigs)) {
    const meta = PROVIDERS[name]
    if (!meta || !values || typeof values !== 'object') continue
    if (Object.prototype.hasOwnProperty.call(values, 'apiKey') && cleanValue(values.apiKey)) {
      updates[meta.keyEnv] = values.apiKey
    }
    if (Object.prototype.hasOwnProperty.call(values, 'baseURL')) updates[meta.baseURLEnv] = values.baseURL
    if (Object.prototype.hasOwnProperty.call(values, 'model')) updates[meta.modelEnv] = values.model
  }

  setProcessEnv(updates)
  await writeEnvUpdates(updates)
  return getPublicConfig()
}
