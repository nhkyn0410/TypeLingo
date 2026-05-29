// Helper gọi backend qua fetch.
// Khi dev: Vite proxy /api sang backend (cổng 8000).
// Khi build: backend phục vụ cùng cổng, nên /api dùng chung đường dẫn.

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = text
    try {
      const parsed = JSON.parse(text)
      msg = parsed?.error || parsed?.message || text
    } catch {
      msg = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
    throw new Error(`API ${path} lỗi ${res.status}${msg ? `: ${msg}` : ''}`)
  }
  return res.json()
}

export function getHealth() {
  return request('/health')
}

// Đọc một file dữ liệu JSON trong data/ theo tên (không kèm đuôi .json).
export function getData(name) {
  return request(`/data/${encodeURIComponent(name)}`)
}

// Ghi/đè một file dữ liệu JSON trong data/.
export function putData(name, value) {
  return request(`/data/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(value),
  })
}

// Liệt kê nhà cung cấp/model đang cấu hình (để frontend hiển thị lựa chọn).
export function getProviders() {
  return request('/providers')
}

// Đọc/lưu cấu hình AI local. GET không trả API key thô.
export function getConfig() {
  return request('/config')
}

export function putConfig(value) {
  return request('/config', {
    method: 'PUT',
    body: JSON.stringify(value),
  })
}

// Dịch tài liệu (txt/md/json) → mảng cặp { en, vi }.
export function translateDocument({ content, type, direction, provider, model }) {
  return request('/translate', {
    method: 'POST',
    body: JSON.stringify({ content, type, direction, provider, model }),
  })
}

// Phân tích lỗi một câu dịch → { score, comment, errors: [{ text, type, suggestion, note }] }.
// Hỗ trợ AbortSignal để hủy khi đổi bài/đổi chiều.
export function analyzeSentence({ source, reference, user, direction, provider, model, signal }) {
  return request('/analyze', {
    method: 'POST',
    body: JSON.stringify({ source, reference, user, direction, provider, model }),
    signal,
  })
}
