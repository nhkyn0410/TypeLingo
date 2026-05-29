// Lớp điều phối nhà cung cấp: chọn adapter theo cấu hình, cùng một giao diện translate(...).
import { getProviderConfig, listProviders, defaultProviderName } from '../config.js'
import * as openai from './openai.js'
import * as anthropic from './anthropic.js'
import * as gemini from './gemini.js'

const ADAPTERS = { openai, anthropic, gemini }

export { listProviders, defaultProviderName }

// Dịch một lô (batch) văn bản bằng nhà cung cấp đã cấu hình.
// texts: string[] → trả về string[] cùng độ dài (theo thứ tự).
export async function translateBatch({ texts, sourceLang, targetLang, provider, model, signal }) {
  const cfg = getProviderConfig(provider)
  if (!cfg) throw new Error(`Nhà cung cấp không hợp lệ: ${provider}`)
  if (!cfg.configured) throw new Error(`Nhà cung cấp "${cfg.name}" chưa có API key trong .env.`)
  const adapter = ADAPTERS[cfg.adapter]
  if (!adapter) throw new Error(`Không tìm thấy adapter: ${cfg.adapter}`)
  const useModel = (model && model.trim()) || cfg.model
  return adapter.translate({
    texts,
    sourceLang,
    targetLang,
    model: useModel,
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    signal,
  })
}

// Phân tích lỗi một câu dịch của học viên bằng nhà cung cấp đã cấu hình.
// → { score, comment, errors: [{ text, type, suggestion, note }] }.
export async function analyzeTranslation({ source, reference, user, sourceLang, targetLang, provider, model, signal }) {
  const cfg = getProviderConfig(provider)
  if (!cfg) throw new Error(`Nhà cung cấp không hợp lệ: ${provider}`)
  if (!cfg.configured) throw new Error(`Nhà cung cấp "${cfg.name}" chưa có API key trong .env.`)
  const adapter = ADAPTERS[cfg.adapter]
  if (!adapter) throw new Error(`Không tìm thấy adapter: ${cfg.adapter}`)
  if (typeof adapter.analyze !== 'function') {
    throw new Error(`Adapter "${cfg.adapter}" chưa hỗ trợ phân tích.`)
  }
  const useModel = (model && model.trim()) || cfg.model
  return adapter.analyze({
    source: source || '',
    reference: reference || '',
    user: user || '',
    sourceLang,
    targetLang,
    model: useModel,
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    signal,
  })
}
