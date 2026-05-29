// Rã từ vựng từ bài dịch. CHỈ rã từ TIẾNG ANH.
//
// Lưu ý: normalizeWord/wordMatches dùng Unicode (khớp cả tiếng Việt) vì chúng phục vụ
// việc tô màu/so khớp khi GÕ ở mọi chiều dịch — đừng đổi. Riêng phần rã từ vựng dưới đây
// chỉ nhận từ tiếng Anh thuần ASCII để không bao giờ thêm nhầm từ tiếng Việt vào kho từ.

export function normalizeWord(text) {
  return (text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join('') || ''
}

export function wordMatches(text) {
  return [...(text || '').matchAll(/[\p{L}\p{N}]+/gu)]
}

// Dấu thanh/nguyên âm đặc trưng tiếng Việt (ngoài bảng ASCII). Có ký tự này ⇒ là tiếng Việt.
const VN_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i

// Văn bản có chứa ký tự tiếng Việt có dấu hay không.
export function hasVietnamese(text) {
  return VN_CHARS.test(text || '')
}

// Từ tiếng Anh: chữ cái ASCII, cho phép dấu nháy/gạch nối ở giữa (don't, state-of-the-art).
// Vì chỉ nhận [A-Za-z] nên từ tiếng Việt có dấu sẽ không lọt vào.
const EN_WORD = /[A-Za-z]+(?:['-][A-Za-z]+)*/g

export function englishWords(text) {
  return (text || '').match(EN_WORD) || []
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your',
])

function makeVocabId(term) {
  return normalizeWord(term).replace(/[^a-z0-9]+/g, '-') || `word-${Date.now()}`
}

// Chọn ra phần TIẾNG ANH của một cặp câu.
// - Bình thường en = tiếng Anh.
// - Nếu chiều dịch cấu hình sai khiến tiếng Việt lọt vào trường en (en có dấu tiếng Việt)
//   mà vi lại là tiếng Anh, ta lấy vi.
// - Nếu cả hai đều giống tiếng Việt ⇒ bỏ qua (không rã), tránh thêm nhầm từ tiếng Việt.
function pickEnglish(pair) {
  const en = (pair?.en || '').trim()
  const vi = (pair?.vi || '').trim()
  if (en && !hasVietnamese(en)) return en
  if (vi && !hasVietnamese(vi)) return vi
  return ''
}

// Gom danh sách TỪ TIẾNG ANH (đã chuẩn hóa, lọc stopword/quá ngắn) kèm tần suất.
// Trả về: [{ term, frequency }] — term ở dạng chữ thường.
export function collectEnglishTerms(pairs) {
  const freq = new Map() // norm -> { term, frequency }
  for (const pair of pairs || []) {
    const enText = pickEnglish(pair)
    if (!enText) continue
    const seenInPair = new Set()
    for (const raw of englishWords(enText)) {
      const norm = normalizeWord(raw)
      if (!norm || norm.length < 3 || STOPWORDS.has(norm)) continue
      if (seenInPair.has(norm)) continue // mỗi câu chỉ tính 1 lần cho tần suất
      seenInPair.add(norm)
      const cur = freq.get(norm)
      if (cur) cur.frequency += 1
      else freq.set(norm, { term: raw.toLowerCase(), frequency: 1 })
    }
  }
  return [...freq.values()]
}

// Lọc ra các từ CHƯA có trong kho (để gọi AI sinh nghĩa/ví dụ cho chúng).
export function newTermsAmong(existing, terms) {
  const have = new Set((existing || []).map((w) => normalizeWord(w.term)))
  return (terms || []).filter((t) => !have.has(normalizeWord(t.term)))
}

// Hợp nhất danh sách từ vào kho.
// - terms: [{ term, frequency }] (chỉ từ tiếng Anh).
// - defsByTerm: { [normalizedTerm]: { meaning, example, exampleVi } } do AI sinh (có thể rỗng).
// Từ mới lấy nghĩa/ví dụ RIÊNG từ AI (không dùng câu gốc); từ đã có chỉ cộng tần suất + nguồn.
export function mergeVocabulary(existing, terms, defsByTerm = {}, title) {
  const byTerm = new Map((existing || []).map((w) => [normalizeWord(w.term), w]))
  const next = [...(existing || [])]
  let added = 0

  for (const { term, frequency = 1 } of terms || []) {
    const norm = normalizeWord(term)
    if (!norm) continue

    const current = byTerm.get(norm)
    if (current) {
      current.frequency = (current.frequency || 1) + frequency
      current.sourceTitles = Array.from(new Set([...(current.sourceTitles || []), title].filter(Boolean)))
      continue
    }

    const def = defsByTerm[norm] || {}
    const meaning = (def.meaning || '').trim()
    const example = (def.example || '').trim()
    const exampleVi = (def.exampleVi || '').trim()
    const created = {
      id: makeVocabId(term),
      term: term.toLowerCase(),
      meaning,
      example,
      exampleVi,
      topic: title || 'Bài dịch',
      learned: false,
      auto: true,
      frequency,
      sourceTitles: title ? [title] : [],
      examples: example ? [{ en: example, vi: exampleVi }] : [],
    }
    byTerm.set(norm, created)
    next.push(created)
    added += 1
  }

  return { next, added }
}
