// Tiện ích dùng chung cho các tính năng.

// Đọc to bằng Web Speech API (mặc định giọng tiếng Anh).
export function speak(text, lang = 'en-US') {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  window.speechSynthesis.speak(u)
}

// Trộn mảng (Fisher–Yates), trả về mảng mới.
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Tạo slug an toàn (bỏ dấu tiếng Việt) để dùng làm id.
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Chuẩn hóa chuỗi để so sánh (đáp án quiz): bỏ khoảng trắng thừa + thường hóa.
export function normalize(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ')
}

// Sinh id duy nhất từ một gốc văn bản.
export function makeId(base) {
  return `${slugify(base) || 'item'}-${Date.now().toString(36)}`
}
