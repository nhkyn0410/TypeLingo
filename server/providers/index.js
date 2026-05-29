// Lớp điều phối nhà cung cấp: chọn adapter theo cấu hình, cùng một giao diện translate(...).
import { getProviderConfig, listProviders, defaultProviderName } from '../config.js'
import * as openai from './openai.js'
import * as anthropic from './anthropic.js'
import * as gemini from './gemini.js'

const ADAPTERS = { openai, anthropic, gemini }

export { listProviders, defaultProviderName }

// Dịch một lô (batch) văn bản bằng nhà cung cấp đã cấu hình.
// texts: string[] → trả về string[] cùng độ dài (theo thứ tự).
// apiKey: ưu tiên key gửi từ trình duyệt (mô hình BYOK); env chỉ là fallback khi chạy local.
export async function translateBatch({ texts, sourceLang, targetLang, provider, model, apiKey, signal }) {
  const cfg = getProviderConfig(provider)
  if (!cfg) throw new Error(`Nhà cung cấp không hợp lệ: ${provider}`)
  const useKey = (typeof apiKey === 'string' && apiKey.trim()) || cfg.apiKey
  if (!useKey) throw new Error(`Thiếu API key cho nhà cung cấp "${cfg.name}". Hãy nhập API key trong tab CẤU HÌNH.`)
  const adapter = ADAPTERS[cfg.adapter]
  if (!adapter) throw new Error(`Không tìm thấy adapter: ${cfg.adapter}`)
  const useModel = (model && model.trim()) || cfg.model
  return adapter.translate({
    texts,
    sourceLang,
    targetLang,
    model: useModel,
    apiKey: useKey,
    baseURL: cfg.baseURL, // baseURL suy ra ở server theo tên provider — KHÔNG nhận từ client (chống SSRF).
    signal,
  })
}

// Phân tích lỗi một câu dịch của học viên bằng nhà cung cấp đã cấu hình.
// → { score, comment, errors: [{ text, type, suggestion, note }] }.
export async function analyzeTranslation({ source, reference, user, sourceLang, targetLang, provider, model, apiKey, signal }) {
  const cfg = getProviderConfig(provider)
  if (!cfg) throw new Error(`Nhà cung cấp không hợp lệ: ${provider}`)
  const useKey = (typeof apiKey === 'string' && apiKey.trim()) || cfg.apiKey
  if (!useKey) throw new Error(`Thiếu API key cho nhà cung cấp "${cfg.name}". Hãy nhập API key trong tab CẤU HÌNH.`)
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
    apiKey: useKey,
    baseURL: cfg.baseURL, // baseURL suy ra ở server theo tên provider — KHÔNG nhận từ client (chống SSRF).
    signal,
  })
}

// Sinh nghĩa + ví dụ riêng cho danh sách từ tiếng Anh bằng nhà cung cấp đã cấu hình.
// → [{ term, meaning, example, exampleVi }].
export async function vocabularyEntries({ words, provider, model, apiKey, signal }) {
  const cfg = getProviderConfig(provider)
  if (!cfg) throw new Error(`Nhà cung cấp không hợp lệ: ${provider}`)
  const useKey = (typeof apiKey === 'string' && apiKey.trim()) || cfg.apiKey
  if (!useKey) throw new Error(`Thiếu API key cho nhà cung cấp "${cfg.name}". Hãy nhập API key trong tab CẤU HÌNH.`)
  const adapter = ADAPTERS[cfg.adapter]
  if (!adapter) throw new Error(`Không tìm thấy adapter: ${cfg.adapter}`)
  if (typeof adapter.defineVocabulary !== 'function') {
    throw new Error(`Adapter "${cfg.adapter}" chưa hỗ trợ tạo từ vựng.`)
  }
  const useModel = (model && model.trim()) || cfg.model
  return adapter.defineVocabulary({
    words,
    model: useModel,
    apiKey: useKey,
    baseURL: cfg.baseURL, // baseURL suy ra ở server theo tên provider — KHÔNG nhận từ client (chống SSRF).
    signal,
  })
}
