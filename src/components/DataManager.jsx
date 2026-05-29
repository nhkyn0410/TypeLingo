import { useRef, useState } from 'react'
import { getData, putData } from '../api/client'

// Các file dữ liệu được sao lưu/khôi phục.
const KEYS = ['exercises', 'vocabulary', 'translate-stats']

export default function DataManager() {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, setPending] = useState(null) // { data, summary }

  const exportAll = async () => {
    setBusy(true)
    setMsg('')
    try {
      const data = {}
      for (const k of KEYS) {
        try { data[k] = await getData(k) } catch { data[k] = null }
      }
      const payload = { app: 'LearnEnglish', exportedAt: new Date().toISOString(), data }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `learnenglish-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMsg('Đã xuất file sao lưu.')
    } catch (e) {
      setMsg(e.message || 'Xuất thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const onPickFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng file
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const data = parsed?.data || parsed
      const summary = KEYS.map((k) => `${k}: ${Array.isArray(data?.[k]) ? data[k].length : data?.[k] != null ? 1 : 0}`)
      setPending({ data, summary })
      setMsg('')
    } catch (err) {
      setMsg('File không hợp lệ: ' + (err.message || 'JSON lỗi'))
    }
  }

  const applyImport = async () => {
    if (!pending) return
    setBusy(true)
    try {
      for (const k of KEYS) {
        if (pending.data?.[k] != null) await putData(k, pending.data[k])
      }
      setMsg('Đã nhập dữ liệu. Đang tải lại...')
      setTimeout(() => window.location.reload(), 400)
    } catch (e) {
      setMsg(e.message || 'Nhập thất bại.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <button
        onClick={exportAll}
        disabled={busy}
        className="border border-edge px-3 py-1.5 text-[10px] tracking-wider text-dim transition-colors hover:text-neon disabled:opacity-40"
        title="Tải file sao lưu toàn bộ dữ liệu"
      >
        ⭳ XUẤT
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="border border-edge px-3 py-1.5 text-[10px] tracking-wider text-dim transition-colors hover:text-accent disabled:opacity-40"
        title="Khôi phục dữ liệu từ file sao lưu"
      >
        ⭱ NHẬP
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onPickFile} className="hidden" />

      {msg && <span className="hud-label hidden text-dim sm:inline">{msg}</span>}

      {/* Hộp xác nhận ghi đè khi nhập */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 px-4" onClick={() => setPending(null)}>
          <div className="panel panel-accent hud-corners w-full max-w-md space-y-4 px-6 py-6" onClick={(e) => e.stopPropagation()}>
            <p className="glow-accent text-lg font-bold tracking-wider">GHI ĐÈ DỮ LIỆU?</p>
            <p className="text-sm text-dim">Thao tác này sẽ thay thế dữ liệu hiện tại bằng dữ liệu trong file:</p>
            <ul className="space-y-1 text-sm text-ink">
              {pending.summary.map((s) => <li key={s}>• {s}</li>)}
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={applyImport}
                disabled={busy}
                className="glow-accent border border-accent/60 px-4 py-2 text-xs tracking-wider text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
              >
                {busy ? 'ĐANG NHẬP…' : 'GHI ĐÈ ▸'}
              </button>
              <button
                onClick={() => setPending(null)}
                disabled={busy}
                className="px-4 py-2 text-xs tracking-wider text-dim hover:text-ink disabled:opacity-40"
              >
                HỦY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
