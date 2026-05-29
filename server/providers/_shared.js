// Tiện ích dùng chung cho các adapter dịch.

const LANG = { en: 'English', vi: 'Vietnamese' }

export const langName = (code) => LANG[code] || code

// Lời nhắc hệ thống chung: yêu cầu trả về JSON gọn để dễ tách câu.
export function buildSystemPrompt(sourceLang, targetLang) {
  return (
    `You are a professional translator. Translate each item from ${langName(sourceLang)} to ${langName(targetLang)}. ` +
    `Keep the original meaning, tone and formatting; translate naturally, not word-for-word. ` +
    `The input is a JSON array of strings. Return ONLY a JSON object {"translations": [...]} ` +
    `whose "translations" array has EXACTLY the same number of items, in the same order. ` +
    `No comments, no markdown, no extra text.`
  )
}

// Lời nhắc phân tích lỗi: đóng vai gia sư, chỉ ra & phân loại lỗi trong bản dịch của học viên.
// targetLang = ngôn ngữ học viên viết ra (đích của bản dịch).
export function buildAnalyzePrompt(sourceLang, targetLang) {
  return (
    `You are a strict but helpful language tutor. A student translated one sentence from ` +
    `${langName(sourceLang)} to ${langName(targetLang)}. You are given the source sentence, a reference ` +
    `translation (only ONE acceptable version among many), and the student's translation.\n` +
    `Find the real mistakes in the STUDENT'S translation compared to the source meaning. Do not punish ` +
    `valid paraphrases or synonyms that differ from the reference but are still correct.\n` +
    `Classify each mistake into exactly one "type":\n` +
    `- "structure": wrong word order / sentence structure.\n` +
    `- "grammar": grammar, tense, agreement, articles, conjugation.\n` +
    `- "vocabulary": wrong or unnatural word choice.\n` +
    `- "context": wrong meaning, mistranslation, omission or addition that changes meaning.\n` +
    `For each error, "text" MUST be an exact, verbatim substring copied from the student's translation ` +
    `(so it can be located and highlighted). If a whole-sentence issue has no single span, use the ` +
    `smallest representative substring.\n` +
    `Return ONLY a JSON object with this shape (no markdown, no extra text):\n` +
    `{"score": <integer 0-100>, "comment": "<short overall comment in Vietnamese>", ` +
    `"errors": [{"text": "<verbatim substring from student>", "type": "structure|grammar|vocabulary|context", ` +
    `"suggestion": "<corrected wording>", "note": "<short explanation in Vietnamese>"}]}\n` +
    `If the translation is fully correct, return an empty "errors" array and a high score. ` +
    `Write "comment" and every "note" in Vietnamese.`
  )
}

// Lời nhắc tạo mục từ vựng: với mỗi từ tiếng Anh, sinh nghĩa tiếng Việt ngắn gọn +
// một câu ví dụ tiếng Anh RIÊNG cho từ đó + bản dịch ví dụ. KHÔNG dùng lại câu gốc trong bài.
export function buildVocabPrompt() {
  return (
    `You are a bilingual English-Vietnamese lexicographer helping a Vietnamese learner. ` +
    `The input is a JSON array of English words. For EACH word, write a concise dictionary-style entry:\n` +
    `- "term": the word in lowercase (use the base/dictionary form if obvious).\n` +
    `- "meaning": a SHORT Vietnamese definition (the common meaning) — a few words, NOT a whole sentence.\n` +
    `- "example": ONE short, natural English sentence that uses the word correctly.\n` +
    `- "exampleVi": the Vietnamese translation of that example sentence.\n` +
    `Return ONLY a JSON object {"entries": [...]} whose "entries" array has EXACTLY one object per ` +
    `input word, in the SAME order. No markdown, no comments, no extra text.`
  )
}

// Tách danh sách mục từ vựng từ chuỗi model trả về (chịu được khi model bọc thêm chữ).
export function parseVocab(content) {
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    const m = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (m) {
      try { parsed = JSON.parse(m[0]) } catch { /* bỏ qua */ }
    }
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.entries
  if (!Array.isArray(list)) {
    throw new Error('Phản hồi từ vựng không đúng định dạng JSON mong đợi.')
  }
  return list.map((e) => ({
    term: e && e.term != null ? String(e.term) : '',
    meaning: e && e.meaning != null ? String(e.meaning) : '',
    example: e && e.example != null ? String(e.example) : '',
    exampleVi: e && e.exampleVi != null ? String(e.exampleVi) : '',
  }))
}

const ERROR_TYPES = new Set(['structure', 'grammar', 'vocabulary', 'context'])

// Tách kết quả phân tích từ chuỗi trả về của model (chịu được khi model bọc thêm chữ).
export function parseAnalysis(content) {
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    const m = content.match(/\{[\s\S]*\}/)
    if (m) {
      try { parsed = JSON.parse(m[0]) } catch { /* bỏ qua */ }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Phản hồi phân tích không đúng định dạng JSON mong đợi.')
  }
  const rawScore = Number(parsed.score)
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : null
  const errors = Array.isArray(parsed.errors)
    ? parsed.errors
        .filter((e) => e && typeof e === 'object' && typeof e.text === 'string' && e.text.trim())
        .map((e) => ({
          text: String(e.text),
          type: ERROR_TYPES.has(e.type) ? e.type : 'context',
          suggestion: e.suggestion != null ? String(e.suggestion) : '',
          note: e.note != null ? String(e.note) : '',
        }))
    : []
  return { score, comment: parsed.comment != null ? String(parsed.comment) : '', errors }
}

// Tách mảng bản dịch từ chuỗi trả về của model (chịu được khi model bọc thêm chữ).
export function parseTranslations(content) {
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    const m = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (m) {
      try { parsed = JSON.parse(m[0]) } catch { /* bỏ qua */ }
    }
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.translations
  if (!Array.isArray(list)) {
    throw new Error('Phản hồi dịch không đúng định dạng JSON mong đợi.')
  }
  return list.map((s) => (typeof s === 'string' ? s : String(s ?? '')))
}
