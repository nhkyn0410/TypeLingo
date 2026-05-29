// Parse tài liệu (txt/md/json) → tách câu → gọi nhà cung cấp dịch (gộp nhiều câu/request)
// → trả mảng cặp { en, vi }.
import { translateBatch } from './providers/index.js'

// Số câu gộp trong một request để tiết kiệm chi phí gọi API.
const BATCH_SIZE = 20

// Tách văn bản thành câu: ngắt theo dòng, rồi theo dấu kết câu + khoảng trắng.
export function splitSentences(text) {
  return String(text)
    .split(/\n+/)
    .flatMap((para) => para.split(/(?<=[.!?。！？…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
}

// Bỏ code block và inline code trong Markdown trước khi tách câu.
function stripMarkdown(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
}

// Rút mọi chuỗi (đệ quy) từ một tài liệu JSON bất kỳ.
function collectStrings(value, out) {
  if (typeof value === 'string') {
    if (value.trim()) out.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out)
    return
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out)
  }
}

function parseJson(content) {
  let data
  try {
    data = JSON.parse(content)
  } catch {
    throw new Error('JSON không hợp lệ.')
  }
  if (Array.isArray(data)) {
    // Đã là mảng cặp { en, vi } → nạp thẳng, không cần dịch.
    if (data.length && data.every((x) => x && typeof x === 'object' && 'en' in x && 'vi' in x)) {
      return { pairs: data.map((x) => ({ en: String(x.en ?? ''), vi: String(x.vi ?? '') })) }
    }
    // Mảng chuỗi → mỗi phần tử là một segment.
    if (data.length && data.every((x) => typeof x === 'string')) {
      return { segments: data.map((s) => s.trim()).filter(Boolean) }
    }
  }
  // Tài liệu JSON bất kỳ → rút các chuỗi text ra để dịch.
  const strings = []
  collectStrings(data, strings)
  return { segments: strings.map((s) => s.trim()).filter(Boolean) }
}

// Trả về { pairs } (đã có sẵn cặp) HOẶC { segments } (cần dịch).
export function parseDocument(content, type) {
  const t = (type || 'txt').toLowerCase()
  if (t === 'json') return parseJson(content)
  if (t === 'md' || t === 'markdown') return { segments: splitSentences(stripMarkdown(content)) }
  return { segments: splitSentences(content) }
}

// Luồng chính: parse → dịch theo lô → ghép cặp { en, vi }.
export async function translateDocument({ content, type, direction = 'en-vi', provider, model, signal }) {
  const [sourceLang, targetLang] = String(direction).split('-')
  if (!sourceLang || !targetLang) throw new Error('Chiều dịch không hợp lệ.')

  const parsed = parseDocument(content, type)

  // JSON đã có cặp { en, vi } → nạp thẳng, không gọi API.
  if (parsed.pairs) {
    return { pairs: parsed.pairs, provider: null, translated: false, count: parsed.pairs.length }
  }

  const segments = parsed.segments
  if (!segments.length) throw new Error('Không tìm thấy nội dung để dịch.')

  const translations = []
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE)
    const out = await translateBatch({ texts: batch, sourceLang, targetLang, provider, model, signal })
    // Đảm bảo độ dài khớp để không vỡ cặp; thiếu thì đệm chuỗi rỗng.
    for (let j = 0; j < batch.length; j++) translations.push(out[j] ?? '')
  }

  const pairs = segments.map((src, i) => {
    const dst = translations[i] ?? ''
    return sourceLang === 'en' ? { en: src, vi: dst } : { en: dst, vi: src }
  })
  return { pairs, provider: provider || null, translated: true, count: pairs.length }
}
