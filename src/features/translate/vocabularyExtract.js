export function normalizeWord(text) {
  return (text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join('') || ''
}

export function wordMatches(text) {
  return [...(text || '').matchAll(/[\p{L}\p{N}]+/gu)]
}

function makeVocabId(term) {
  return normalizeWord(term).replace(/[^a-z0-9]+/g, '-') || `word-${Date.now()}`
}

export function mergeVocabularyFromPairs(existing, pairs, title) {
  const stopwords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'this', 'to', 'was', 'we', 'were', 'with', 'you', 'your',
  ])
  const byTerm = new Map((existing || []).map((w) => [normalizeWord(w.term), w]))
  const next = [...(existing || [])]
  let added = 0

  pairs.forEach((pair) => {
    const en = pair.en || ''
    const vi = pair.vi || ''
    const seen = new Set()
    wordMatches(en).forEach((match) => {
      const term = match[0]
      const norm = normalizeWord(term)
      if (!norm || norm.length < 3 || stopwords.has(norm) || seen.has(norm)) return
      seen.add(norm)
      const current = byTerm.get(norm)
      if (current) {
        current.examples = Array.isArray(current.examples) ? current.examples : []
        if (current.example && !current.examples.some((ex) => ex.en === current.example)) {
          current.examples.push({ en: current.example, vi: current.exampleVi || '' })
        }
        if (!current.examples.some((ex) => ex.en === en)) current.examples.push({ en, vi })
        if (!current.example) current.example = en
        if (!current.exampleVi) current.exampleVi = vi
        current.sourceTitles = Array.from(new Set([...(current.sourceTitles || []), title].filter(Boolean)))
        current.frequency = (current.frequency || 1) + 1
        return
      }
      const created = {
        id: makeVocabId(term),
        term: term.toLowerCase(),
        meaning: vi || 'Xem câu dịch tham chiếu.',
        example: en,
        exampleVi: vi,
        topic: title || 'Bài dịch',
        learned: false,
        auto: true,
        frequency: 1,
        sourceTitles: title ? [title] : [],
        examples: [{ en, vi }],
      }
      byTerm.set(norm, created)
      next.push(created)
      added += 1
    })
  })

  return { next, added }
}
