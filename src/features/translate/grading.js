// Chấm "mềm": so sánh bản dịch của người dùng với bản tham chiếu theo mức trùng từ.
// Không yêu cầu khớp tuyệt đối vì một câu có nhiều cách dịch đúng.

const TOKEN_RE = /[\p{L}\p{N}]+/gu

export function tokenize(text) {
  return (text || '').toLowerCase().match(TOKEN_RE) || []
}

export function gradeTranslation(userText, referenceText) {
  const userTokens = tokenize(userText)
  const refTokens = tokenize(referenceText)
  const userSet = new Set(userTokens)
  const refSet = new Set(refTokens)

  let overlap = 0
  for (const t of refSet) if (userSet.has(t)) overlap++

  // Hệ số tương đồng Dice: 2*|giao| / (|user| + |ref|)
  const denom = refSet.size + userSet.size
  const similarity = denom === 0 ? 0 : Math.round((2 * overlap * 100) / denom)

  // Tách bản tham chiếu, giữ khoảng trắng, gắn cờ "trùng" cho từng từ để tô màu.
  const refWords = (referenceText || '').split(/(\s+)/).map((chunk) => {
    if (chunk === '' || /^\s+$/.test(chunk)) return { text: chunk, space: true }
    const norm = (chunk.toLowerCase().match(TOKEN_RE) || [])[0]
    return { text: chunk, matched: norm ? userSet.has(norm) : false }
  })

  const extraCount = userTokens.filter((t) => !refSet.has(t)).length

  return {
    similarity,
    overlap,
    refCount: refSet.size,
    userCount: userSet.size,
    extraCount,
    refWords,
  }
}

// Đếm số từ (để tính WPM).
export function countWords(text) {
  return tokenize(text).length
}
