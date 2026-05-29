// Adapter cho Google Gemini — endpoint POST {baseURL}/v1beta/models/{model}:generateContent.
// Dùng header x-goog-api-key để KHÔNG đặt API key trên URL.
import { buildSystemPrompt, parseTranslations, buildAnalyzePrompt, parseAnalysis } from './_shared.js'

export async function translate({ texts, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')
  if (!Array.isArray(texts) || texts.length === 0) return []

  const base = baseURL.replace(/\/+$/, '')
  const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(sourceLang, targetLang) }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(texts) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('')
  return parseTranslations(content)
}

// Phân tích lỗi một câu dịch của học viên → { score, comment, errors }.
export async function analyze({ source, reference, user, sourceLang, targetLang, model, apiKey, baseURL, signal }) {
  if (!apiKey) throw new Error('Thiếu API key cho nhà cung cấp này.')

  const base = baseURL.replace(/\/+$/, '')
  const url = `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildAnalyzePrompt(sourceLang, targetLang) }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify({ source, reference, student: user }) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Lỗi gọi API (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || '').join('')
  return parseAnalysis(content)
}
