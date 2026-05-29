// Adapter cho API tương thích chuẩn OpenAI (OpenAI, DeepSeek, Mistral, Ollama/LM Studio...).
// Tất cả dùng chung endpoint POST {baseURL}/chat/completions.
import { buildSystemPrompt, parseTranslations, buildAnalyzePrompt, parseAnalysis, buildVocabPrompt, parseVocab } from './_shared.js'

export async function translate({ texts, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')
  if (!Array.isArray(texts) || texts.length === 0) return []

  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildSystemPrompt(sourceLang, targetLang) },
        { role: 'user', content: JSON.stringify(texts) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return parseTranslations(content)
}

// Phân tích lỗi một câu dịch của học viên → { score, comment, errors }.
export async function analyze({ source, reference, user, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')

  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildAnalyzePrompt(sourceLang, targetLang) },
        { role: 'user', content: JSON.stringify({ source, reference, student: user }) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return parseAnalysis(content)
}

// Sinh nghĩa + ví dụ riêng cho danh sách từ tiếng Anh → [{ term, meaning, example, exampleVi }].
export async function defineVocabulary({ words, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')
  if (!Array.isArray(words) || words.length === 0) return []

  const url = `${baseURL.replace(/\/+$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildVocabPrompt() },
        { role: 'user', content: JSON.stringify(words) },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  return parseVocab(content)
}
