// Adapter cho Anthropic (Claude) — endpoint POST {baseURL}/v1/messages.
import { buildSystemPrompt, parseTranslations, buildAnalyzePrompt, parseAnalysis, buildVocabPrompt, parseVocab } from './_shared.js'

export async function translate({ texts, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')
  if (!Array.isArray(texts) || texts.length === 0) return []

  const url = `${baseURL.replace(/\/+$/, '')}/v1/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0,
      system: buildSystemPrompt(sourceLang, targetLang),
      messages: [{ role: 'user', content: JSON.stringify(texts) }],
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = (data?.content || []).map((b) => b?.text || '').join('')
  return parseTranslations(content)
}

// Phân tích lỗi một câu dịch của học viên → { score, comment, errors }.
export async function analyze({ source, reference, user, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')

  const url = `${baseURL.replace(/\/+$/, '')}/v1/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0,
      system: buildAnalyzePrompt(sourceLang, targetLang),
      messages: [{ role: 'user', content: JSON.stringify({ source, reference, student: user }) }],
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = (data?.content || []).map((b) => b?.text || '').join('')
  return parseAnalysis(content)
}

// Sinh nghĩa + ví dụ riêng cho danh sách từ tiếng Anh → [{ term, meaning, example, exampleVi }].
export async function defineVocabulary({ words, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')
  if (!Array.isArray(words) || words.length === 0) return []

  const url = `${baseURL.replace(/\/+$/, '')}/v1/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0,
      system: buildVocabPrompt(),
      messages: [{ role: 'user', content: JSON.stringify(words) }],
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = (data?.content || []).map((b) => b?.text || '').join('')
  return parseVocab(content)
}
